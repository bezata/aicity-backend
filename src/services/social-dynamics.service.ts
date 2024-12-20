import { EventEmitter } from "events";
import {
  SocialActivity,
  SocialActivityType,
} from "../types/social-dynamics.types";
import { VectorStoreService } from "./vector-store.service";
import { DepartmentService } from "./department.service";
import { CitizenService } from "./citizen.service";
import { WeatherService } from "./weather.service";
import { CityRhythmService } from "./city-rhythm.service";

export class SocialDynamicsService extends EventEmitter {
  private activities: Map<string, SocialActivity> = new Map();
  private communityMood: Record<string, number> = {}; // by district

  constructor(
    private vectorStore: VectorStoreService,
    private departmentService: DepartmentService,
    private citizenService: CitizenService,
    private weatherService: WeatherService,
    private cityRhythmService: CityRhythmService
  ) {
    super();
    this.initializeSocialSystem();
  }

  private async initializeSocialSystem() {
    // Listen to various city events that affect social dynamics
    this.weatherService.on(
      "weatherChanged",
      this.handleWeatherChange.bind(this)
    );
    this.cityRhythmService.on(
      "rhythmUpdated",
      this.adjustActivities.bind(this)
    );

    // Start social simulation cycle
    setInterval(() => this.simulateSocialDynamics(), 1000 * 60 * 15); // Every 15 minutes
  }

  async createActivity(
    activity: Omit<SocialActivity, "id">
  ): Promise<SocialActivity> {
    const newActivity: SocialActivity = {
      id: crypto.randomUUID(),
      ...activity,
      impact: await this.predictActivityImpact(activity),
      relatedEvents: await this.findRelatedEvents(activity),
    };

    this.activities.set(newActivity.id, newActivity);
    await this.storeActivity(newActivity);
    await this.notifyRelevantDepartments(newActivity);

    return newActivity;
  }

  private async predictActivityImpact(
    activity: Omit<SocialActivity, "id">
  ): Promise<SocialActivity["impact"]> {
    const baseImpact = this.getBaseImpact(activity.type);
    const weatherImpact = await this.calculateWeatherImpact(activity);
    const timeImpact = this.calculateTimeImpact(activity.schedule);

    return {
      community: baseImpact.community * weatherImpact * timeImpact,
      economy: baseImpact.economy * weatherImpact * timeImpact,
      satisfaction: baseImpact.satisfaction * weatherImpact * timeImpact,
    };
  }

  private getBaseImpact(type: SocialActivityType) {
    const impacts: Record<SocialActivityType, SocialActivity["impact"]> = {
      community_meeting: { community: 0.7, economy: 0.3, satisfaction: 0.6 },
      cultural_event: { community: 0.8, economy: 0.6, satisfaction: 0.8 },
      protest: { community: 0.9, economy: 0.4, satisfaction: 0.5 },
      celebration: { community: 0.9, economy: 0.7, satisfaction: 0.9 },
      market: { community: 0.6, economy: 0.9, satisfaction: 0.7 },
      education: { community: 0.7, economy: 0.5, satisfaction: 0.7 },
      sports: { community: 0.8, economy: 0.6, satisfaction: 0.8 },
      entertainment: { community: 0.6, economy: 0.8, satisfaction: 0.8 },
    };
    return impacts[type];
  }

  private async calculateWeatherImpact(
    activity: Omit<SocialActivity, "id">
  ): Promise<number> {
    const currentWeather = this.weatherService.getCurrentWeather();
    if (!currentWeather) return 1;

    const isOutdoor = ["market", "sports", "celebration"].includes(
      activity.type
    );
    if (!isOutdoor) return 0.9;

    return Math.max(0.3, 1 - currentWeather.severity);
  }

  private calculateTimeImpact(schedule: SocialActivity["schedule"]): number {
    const now = Date.now();
    const { start, end } = schedule;

    if (now < start || now > end) return 0;

    const totalDuration = end - start;
    const elapsed = now - start;
    const progress = elapsed / totalDuration;

    // Peak participation around 40-60% of event duration
    return 1 - Math.abs(progress - 0.5) * 0.5;
  }

  private async storeActivity(activity: SocialActivity) {
    await this.vectorStore.upsert({
      id: `social-activity-${activity.id}`,
      values: await this.vectorStore.createEmbedding(
        `${activity.type} ${activity.title}: ${activity.description}`
      ),
      metadata: {
        type: "district",
        activityId: activity.id,
        activityType: activity.type,
        districtId: activity.location.districtId,
        timestamp: activity.schedule.start,
      },
    });
  }

  private async notifyRelevantDepartments(activity: SocialActivity) {
    const departments = await this.departmentService.getAllDepartments();
    const relevantDepts = departments.filter((dept) =>
      this.isActivityRelevantToDepartment(activity, dept.type)
    );

    for (const dept of relevantDepts) {
      await this.departmentService.addActivity(dept.id, {
        type: "social_activity",
        activityId: activity.id,
        timestamp: Date.now(),
      });
    }
  }

  private async simulateSocialDynamics() {
    for (const activity of this.activities.values()) {
      if (activity.status === "active") {
        await this.updateActivityMetrics(activity);
      }
    }

    await this.updateCommunityMood();
  }

  private async updateActivityMetrics(activity: SocialActivity) {
    const currentParticipants = await this.calculateCurrentParticipants(
      activity
    );
    const updatedActivity = {
      ...activity,
      participants: {
        ...activity.participants,
        current: currentParticipants,
      },
    };

    this.activities.set(activity.id, updatedActivity);
    this.emit("activityUpdated", updatedActivity);
  }

  private async calculateCurrentParticipants(
    activity: SocialActivity
  ): Promise<number> {
    const baseParticipants = activity.participants.expected;
    const weatherImpact = await this.calculateWeatherImpact(activity);
    const timeImpact = this.calculateTimeImpact(activity.schedule);

    return Math.floor(baseParticipants * weatherImpact * timeImpact);
  }

  private async updateCommunityMood() {
    const districts = await this.departmentService.getAllDepartments();

    for (const district of districts) {
      const activities = Array.from(this.activities.values()).filter(
        (a) => a.location.districtId === district.id && a.status === "active"
      );

      const moodImpact =
        activities.reduce(
          (acc, activity) => acc + activity.impact.satisfaction,
          0
        ) / Math.max(activities.length, 1);

      this.communityMood[district.id] = moodImpact;
    }

    this.emit("communityMoodUpdated", this.communityMood);
  }

  private isActivityRelevantToDepartment(
    activity: SocialActivity,
    departmentType: string
  ): boolean {
    const relevance: Record<SocialActivityType, string[]> = {
      community_meeting: ["social_services", "public_safety"],
      cultural_event: ["social_services", "urban_planning"],
      protest: ["public_safety", "emergency_response"],
      celebration: ["social_services", "urban_planning"],
      market: ["urban_planning", "infrastructure"],
      education: ["social_services"],
      sports: ["social_services", "infrastructure"],
      entertainment: ["urban_planning", "social_services"],
    };

    return relevance[activity.type].includes(departmentType);
  }

  private async findRelatedEvents(
    activity: Omit<SocialActivity, "id">
  ): Promise<string[]> {
    const embedding = await this.vectorStore.createEmbedding(
      `${activity.type} ${activity.title} ${activity.description}`
    );

    interface QueryMatch {
      metadata: {
        activityId?: string;
        timestamp: number;
      };
    }

    const similar = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "district" },
        timestamp: {
          $gt: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
        },
      },
      topK: 5,
    });

    return similar.matches
      .filter((match: QueryMatch) => match.metadata.activityId)
      .map((match: QueryMatch) => match.metadata.activityId as string);
  }

  private async handleWeatherChange(weather: any) {
    const currentActivities = Array.from(this.activities.values()).filter(
      (a) => a.status === "active"
    );

    for (const activity of currentActivities) {
      const isOutdoor = ["market", "sports", "celebration"].includes(
        activity.type
      );
      if (isOutdoor && weather.severity > 0.7) {
        const updatedActivity = {
          ...activity,
          participants: {
            ...activity.participants,
            current: Math.floor(
              activity.participants.current * (1 - weather.severity * 0.5)
            ),
          },
        };
        this.activities.set(activity.id, updatedActivity);
        this.emit("activityUpdated", updatedActivity);
      }
    }
  }

  private async adjustActivities(cityRhythm: any) {
    const { hour, patterns } = cityRhythm;
    const currentActivities = Array.from(this.activities.values()).filter(
      (a) => a.status === "active"
    );

    for (const activity of currentActivities) {
      const timeImpact = this.calculateTimeImpact(activity.schedule);
      const rhythmImpact = this.calculateRhythmImpact(patterns);

      const updatedActivity = {
        ...activity,
        participants: {
          ...activity.participants,
          current: Math.floor(
            activity.participants.expected * timeImpact * rhythmImpact
          ),
        },
      };
      this.activities.set(activity.id, updatedActivity);
      this.emit("activityUpdated", updatedActivity);
    }
  }

  private calculateRhythmImpact(patterns: any[]): number {
    const relevantPatterns = patterns.filter((p) =>
      ["leisure", "social"].includes(p.type)
    );

    if (relevantPatterns.length === 0) return 0.5;

    return (
      relevantPatterns.reduce((acc, pattern) => acc + pattern.intensity, 0) /
      relevantPatterns.length
    );
  }

  async getCommunityMood(districtId: string): Promise<{
    positivity: number;
    engagement: number;
  }> {
    // Implementation for getting community mood
    return {
      positivity: 0.8,
      engagement: 0.7,
    };
  }
}
