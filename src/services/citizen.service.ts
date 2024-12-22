import { EventEmitter } from "events";
import { Citizen, CitizenNeed } from "../types/citizen.types";
import { VectorStoreService } from "./vector-store.service";
import { TogetherService } from "./together.service";
import { DepartmentService } from "./department.service";
import { AnalyticsService } from "./analytics.service";

export class CitizenService extends EventEmitter {
  private citizens: Map<string, Citizen> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService,
    private departmentService: DepartmentService,
    private analyticsService: AnalyticsService
  ) {
    super();
    this.initializeService();
  }

  private initializeService() {
    // Track citizen needs
    this.on("newCitizenNeed", ({ citizenId, need }) => {
      this.analyticsService.trackInteraction(
        { id: citizenId, type: "citizen" } as any,
        {
          type: "need",
          content: need.description,
          sentiment: 1 - need.urgency, // Higher urgency = lower sentiment
          topics: [need.type, "need", "citizen"],
        } as any
      );
    });

    // Track citizen activities
    this.on("citizenActivityUpdated", ({ citizenId, activity }) => {
      this.analyticsService.trackInteraction(
        { id: citizenId, type: "citizen" } as any,
        {
          type: "activity",
          content: `Citizen engaged in ${activity.type}`,
          sentiment: 0.5 + activity.intensity * 0.5, // Higher intensity = more positive sentiment
          topics: ["activity", activity.type, "citizen"],
        } as any
      );
    });
  }

  async simulateCitizenNeeds() {
    for (const citizen of this.citizens.values()) {
      if (Math.random() < 0.3) {
        // 30% chance of new need
        const need = await this.generateRandomNeed(citizen);
        citizen.needs.push(need);
        await this.routeNeedToDepartment(citizen.id, need);

        // Track overall citizen mood based on needs
        this.analyticsService.trackMood(this.calculateCitizenMood(citizen));
      }
    }
  }

  private calculateCitizenMood(citizen: Citizen): number {
    if (!citizen.needs.length) return 0.8; // Default happy mood if no needs

    // Calculate mood based on needs urgency and status
    const urgentNeeds = citizen.needs.filter(
      (n) => n.urgency > 0.7 && n.status === "pending"
    );
    const resolvedNeeds = citizen.needs.filter((n) => n.status === "resolved");

    const moodScore =
      0.8 - // Base mood
      urgentNeeds.length * 0.2 + // Decrease for urgent needs
      resolvedNeeds.length * 0.1; // Increase for resolved needs

    return Math.max(0, Math.min(1, moodScore)); // Ensure between 0 and 1
  }

  private async generateRandomNeed(citizen: Citizen): Promise<CitizenNeed> {
    const needTypes = [
      "infrastructure",
      "service",
      "safety",
      "environmental",
      "social",
    ];
    const type = needTypes[
      Math.floor(Math.random() * needTypes.length)
    ] as CitizenNeed["type"];

    const prompt = `Generate a realistic city-related need for a citizen who works as ${citizen.occupation} in the ${citizen.district} district.`;
    const description = await this.togetherService.generateText(prompt);

    return {
      type,
      description,
      urgency: Math.random(),
      status: "pending",
      created: Date.now(),
    };
  }

  private async routeNeedToDepartment(citizenId: string, need: CitizenNeed) {
    // Store in vector DB for pattern analysis
    await this.vectorStore.upsert({
      id: `citizen-need-${citizenId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(need.description),
      metadata: {
        type: "district",
        citizenId,
        needType: need.type,
        urgency: need.urgency,
        timestamp: need.created,
      },
    });

    this.emit("newCitizenNeed", { citizenId, need });
  }

  async updateActivityLevels(type: string, intensity: number): Promise<void> {
    for (const citizen of this.citizens.values()) {
      // Update activity state for each citizen
      citizen.currentActivity = {
        type,
        intensity,
        timestamp: Date.now(),
      };

      // Emit activity update event
      this.emit("citizenActivityUpdated", {
        citizenId: citizen.id,
        activity: citizen.currentActivity,
      });
    }
  }

  // New methods for analytics
  async getCitizenAnalytics(citizenId: string) {
    const citizen = this.citizens.get(citizenId);
    if (!citizen) throw new Error("Citizen not found");

    return {
      needsAnalysis: {
        total: citizen.needs.length,
        pending: citizen.needs.filter((n) => n.status === "pending").length,
        resolved: citizen.needs.filter((n) => n.status === "resolved").length,
        urgentCount: citizen.needs.filter((n) => n.urgency > 0.7).length,
        byType: this.groupNeedsByType(citizen.needs),
      },
      activityAnalysis: {
        currentActivity: citizen.currentActivity,
        mood: this.calculateCitizenMood(citizen),
        engagementLevel: this.calculateEngagementLevel(citizen),
      },
      districtInteraction: {
        district: citizen.district,
        participation: await this.getDistrictParticipation(citizen),
      },
    };
  }

  private groupNeedsByType(needs: CitizenNeed[]): Record<string, number> {
    return needs.reduce((acc, need) => {
      acc[need.type] = (acc[need.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateEngagementLevel(citizen: Citizen): number {
    if (!citizen.currentActivity) return 0;

    const recencyScore = Math.max(
      0,
      1 -
        (Date.now() - citizen.currentActivity.timestamp) / (24 * 60 * 60 * 1000)
    );

    return citizen.currentActivity.intensity * 0.7 + recencyScore * 0.3;
  }

  private async getDistrictParticipation(citizen: Citizen): Promise<number> {
    const recentNeeds = citizen.needs.filter(
      (n) => Date.now() - n.created < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );

    return recentNeeds.length > 0 ? 0.5 + recentNeeds.length * 0.1 : 0.5;
  }
}
