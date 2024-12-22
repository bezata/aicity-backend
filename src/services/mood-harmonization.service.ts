import { EventEmitter } from "events";
import { DistrictService } from "./district.service";
import { District } from "../types/district.types";
import { MetricsService } from "./metrics.service";
import { EventBus } from "./event-bus.service";
import { VectorStoreService } from "./vector-store.service";

interface AIHarmonyMetrics {
  agentMoodIndex: number;
  aiCitizenSatisfaction: number;
  humanAIInteractionQuality: number;
  culturalIntegrationScore: number;
  adaptiveResponseRate: number;
}

interface DistrictCoordinates {
  latitude: number;
  longitude: number;
  area: number;
}

interface EnhancedDistrict extends District {
  coordinates: DistrictCoordinates;
  aiMetrics: AIHarmonyMetrics;
}

export class MoodHarmonizationService extends EventEmitter {
  private readonly eventBus: EventBus;

  constructor(
    private districtService: DistrictService,
    private metricsService: MetricsService,
    private vectorStore: VectorStoreService
  ) {
    super();
    this.eventBus = EventBus.getInstance();
    this.initializeAIHarmonization();
  }

  private initializeAIHarmonization() {
    // Monitor AI-human harmony every 5 minutes
    setInterval(() => this.monitorAIHarmony(), 5 * 60 * 1000);
    // Analyze cultural integration every 15 minutes
    setInterval(() => this.analyzeAICulturalIntegration(), 15 * 60 * 1000);
  }

  async harmonizeCityMood() {
    const moodMap = await this.generateMoodMap();
    const aiInsights = await this.metricsService.getMetricsAnalysis();
    const interventions = await this.designInterventions(moodMap, aiInsights);
    await this.implementHarmonization(interventions);
  }

  private async monitorAIHarmony() {
    const districts = await this.districtService.getAllDistricts();
    for (const district of districts) {
      const harmonyMetrics = await this.calculateAIHarmonyMetrics(
        district as EnhancedDistrict
      );
      if (harmonyMetrics.agentMoodIndex < 0.6) {
        this.eventBus.emit("aiHarmonyAlert", {
          districtId: district.id,
          metrics: harmonyMetrics,
          severity: "high",
        });
      }
    }
  }

  private async analyzeAICulturalIntegration() {
    const districts = await this.districtService.getAllDistricts();
    for (const district of districts) {
      const integrationScore = await this.assessCulturalIntegration(
        district as EnhancedDistrict
      );
      if (integrationScore < 0.5) {
        this.eventBus.emit("culturalIntegrationNeeded", {
          districtId: district.id,
          score: integrationScore,
          recommendations: await this.generateIntegrationRecommendations(
            district as EnhancedDistrict
          ),
        });
      }
    }
  }

  private async analyzeDominantMood(
    district: EnhancedDistrict
  ): Promise<string> {
    const moodFactors = {
      // Environmental factors
      noise: district.metrics.noise || 0,
      crowding: district.metrics.crowding || 0,
      cleanliness: district.metrics.cleanliness || 0,

      // Social factors
      culturalVibrancy: district.metrics.culturalVibrancy || 0,
      communityWellbeing: district.metrics.communityWellbeing || 0,
      socialCohesion: district.metrics.socialCohesion || 0,

      // Economic factors
      economicGrowth: district.metrics.economicGrowth || 0,
      businessActivity: district.metrics.businessActivity || 0,

      // AI Integration factors
      aiHarmony: district.aiMetrics.agentMoodIndex,
      aiSatisfaction: district.aiMetrics.aiCitizenSatisfaction,
      interactionQuality: district.aiMetrics.humanAIInteractionQuality,
    };

    const averageScore =
      Object.values(moodFactors).reduce((sum, val) => sum + val, 0) /
      Object.keys(moodFactors).length;

    if (averageScore > 0.8) return "jubilant";
    if (averageScore > 0.6) return "content";
    if (averageScore > 0.4) return "neutral";
    if (averageScore > 0.2) return "tense";
    return "distressed";
  }

  private async identifyTensionPoints(district: EnhancedDistrict) {
    const tensionPoints = [];

    // Check environmental tensions
    if (district.metrics.noise > 0.7) {
      tensionPoints.push({
        location: district.coordinates,
        intensity: district.metrics.noise,
        cause: "high_noise_levels",
      });
    }

    if (district.metrics.crowding > 0.8) {
      tensionPoints.push({
        location: district.coordinates,
        intensity: district.metrics.crowding,
        cause: "overcrowding",
      });
    }

    // Check AI-related tensions
    if (district.aiMetrics.humanAIInteractionQuality < 0.6) {
      tensionPoints.push({
        location: district.coordinates,
        intensity: 1 - district.aiMetrics.humanAIInteractionQuality,
        cause: "ai_interaction_friction",
      });
    }

    if (district.aiMetrics.culturalIntegrationScore < 0.5) {
      tensionPoints.push({
        location: district.coordinates,
        intensity: 1 - district.aiMetrics.culturalIntegrationScore,
        cause: "ai_cultural_gap",
      });
    }

    return tensionPoints;
  }

  private async calculateHarmonyScore(
    district: EnhancedDistrict
  ): Promise<number> {
    const weights = {
      socialCohesion: 0.2,
      culturalVibrancy: 0.15,
      communityWellbeing: 0.15,
      environmentalHealth: 0.1,
      publicServiceAccess: 0.1,
      aiHarmony: 0.15,
      aiIntegration: 0.15,
    };

    const aiScore =
      district.aiMetrics.agentMoodIndex * 0.3 +
      district.aiMetrics.aiCitizenSatisfaction * 0.3 +
      district.aiMetrics.culturalIntegrationScore * 0.4;

    const traditionalScore = Object.entries(weights).reduce(
      (score, [metric, weight]) => {
        if (metric.startsWith("ai")) return score;
        return (
          score +
          (district.metrics[metric as keyof typeof district.metrics] || 0) *
            weight
        );
      },
      0
    );

    return traditionalScore * 0.7 + aiScore * 0.3;
  }

  private async calculateAIHarmonyMetrics(
    district: EnhancedDistrict
  ): Promise<AIHarmonyMetrics> {
    // Query vector store for AI interaction patterns
    const query = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `AI harmony patterns in district ${district.id}`
      ),
      filter: { type: { $eq: "ai_harmony" } },
      topK: 5,
    });

    // Process and aggregate results
    const patterns = query.matches.map((m: any) => m.metadata);
    return {
      agentMoodIndex: this.aggregateMetric(patterns, "agentMood"),
      aiCitizenSatisfaction: this.aggregateMetric(patterns, "satisfaction"),
      humanAIInteractionQuality: this.aggregateMetric(patterns, "interaction"),
      culturalIntegrationScore: this.aggregateMetric(patterns, "cultural"),
      adaptiveResponseRate: this.aggregateMetric(patterns, "adaptation"),
    };
  }

  private aggregateMetric(patterns: any[], key: string): number {
    const values = patterns
      .map((p: Record<string, number>) => p[key])
      .filter((v) => typeof v === "number");
    return values.length
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : 0.5;
  }

  private async assessCulturalIntegration(
    district: EnhancedDistrict
  ): Promise<number> {
    return (
      district.aiMetrics.culturalIntegrationScore * 0.4 +
      district.aiMetrics.humanAIInteractionQuality * 0.3 +
      district.aiMetrics.adaptiveResponseRate * 0.3
    );
  }

  private async generateIntegrationRecommendations(
    district: EnhancedDistrict
  ): Promise<string[]> {
    const recommendations = [];
    const metrics = district.aiMetrics;

    if (metrics.humanAIInteractionQuality < 0.6) {
      recommendations.push("Implement AI-Human interaction workshops");
    }
    if (metrics.culturalIntegrationScore < 0.5) {
      recommendations.push("Organize cross-cultural AI-Human events");
    }
    if (metrics.adaptiveResponseRate < 0.7) {
      recommendations.push("Enhance AI adaptation protocols");
    }

    return recommendations;
  }

  private async generateMoodMap(): Promise<DistrictMood[]> {
    const districts = await this.districtService.getAllDistricts();
    return Promise.all(
      districts.map(async (district) => {
        const enhancedDistrict = district as EnhancedDistrict;
        enhancedDistrict.aiMetrics = await this.calculateAIHarmonyMetrics(
          enhancedDistrict
        );
        return {
          districtId: district.id,
          dominantMood: await this.analyzeDominantMood(enhancedDistrict),
          tensionPoints: await this.identifyTensionPoints(enhancedDistrict),
          harmonyScore: await this.calculateHarmonyScore(enhancedDistrict),
        };
      })
    );
  }

  private async designInterventions(moodMap: DistrictMood[], aiInsights: any) {
    return Promise.all(
      moodMap.map(async (mood) => {
        const district = await this.districtService.getDistrict(
          mood.districtId
        );
        const enhancedDistrict = district as EnhancedDistrict;

        return {
          districtId: mood.districtId,
          suggestedEvents: this.generateHarmonyEvents(
            mood,
            enhancedDistrict.aiMetrics
          ),
          environmentalAdjustments: await this.suggestEnvironmentalChanges(
            mood,
            enhancedDistrict
          ),
          culturalActivities: await this.recommendCulturalActivities(
            mood,
            enhancedDistrict
          ),
          aiIntegrationPlans: await this.generateAIIntegrationPlans(
            enhancedDistrict,
            aiInsights
          ),
        };
      })
    );
  }

  private generateHarmonyEvents(
    mood: DistrictMood,
    aiMetrics: AIHarmonyMetrics
  ) {
    const events = [];

    // AI-specific events
    if (aiMetrics.humanAIInteractionQuality < 0.6) {
      events.push({ type: "ai_human_dialogue", priority: "high" });
    }
    if (aiMetrics.culturalIntegrationScore < 0.5) {
      events.push({ type: "cultural_exchange_with_ai", priority: "high" });
    }

    // Traditional events based on mood
    switch (mood.dominantMood) {
      case "distressed":
        events.push(
          { type: "ai_assisted_community_gathering", priority: "high" },
          { type: "ai_wellness_program", priority: "high" }
        );
        break;
      case "tense":
        events.push(
          { type: "ai_mediated_forum", priority: "medium" },
          { type: "hybrid_art_exhibition", priority: "medium" }
        );
        break;
      default:
        events.push(
          { type: "ai_cultural_festival", priority: "medium" },
          { type: "human_ai_collaboration_showcase", priority: "low" }
        );
    }

    return events;
  }

  private async generateAIIntegrationPlans(
    district: EnhancedDistrict,
    aiInsights: any
  ) {
    return {
      shortTerm: await this.generateShortTermIntegration(district, aiInsights),
      mediumTerm: await this.generateMediumTermIntegration(
        district,
        aiInsights
      ),
      longTerm: await this.generateLongTermIntegration(district, aiInsights),
    };
  }

  private async generateShortTermIntegration(
    district: EnhancedDistrict,
    aiInsights: any
  ) {
    const plans = [];

    if (district.aiMetrics.humanAIInteractionQuality < 0.6) {
      plans.push({
        action: "Implement immediate AI-human interaction improvements",
        priority: "high",
        timeline: "1-2 weeks",
      });
    }

    return plans;
  }

  private async generateMediumTermIntegration(
    district: EnhancedDistrict,
    aiInsights: any
  ) {
    const plans = [];

    if (district.aiMetrics.culturalIntegrationScore < 0.7) {
      plans.push({
        action: "Develop AI-human cultural exchange programs",
        priority: "medium",
        timeline: "1-3 months",
      });
    }

    return plans;
  }

  private async generateLongTermIntegration(
    district: EnhancedDistrict,
    aiInsights: any
  ) {
    const plans = [];

    if (district.aiMetrics.adaptiveResponseRate < 0.8) {
      plans.push({
        action: "Establish permanent AI-human integration frameworks",
        priority: "medium",
        timeline: "6-12 months",
      });
    }

    return plans;
  }

  private async implementHarmonization(interventions: any) {
    for (const intervention of interventions) {
      this.eventBus.emit("harmonyEvent", {
        districtId: intervention.districtId,
        suggestedEvents: intervention.suggestedEvents,
        environmentalChanges: intervention.environmentalAdjustments,
        culturalActivities: intervention.culturalActivities,
        aiIntegrationPlans: intervention.aiIntegrationPlans,
      });

      // Update district metrics with AI-aware values
      await this.districtService.updateMetrics(intervention.districtId, {
        socialMetrics: {
          index: 0.8,
          communityEngagement: 0.7,
          publicServices: 0.7,
          culturalDiversity: 0.7,
          socialCohesion: 0.7,
        },
        economicMetrics: {
          index: 0.7,
          businessActivity: 0.7,
          employment: 0.7,
          innovation: 0.7,
          marketDynamics: 0.7,
        },
        culturalMetrics: {
          index: 0.7,
          events: 0.7,
          heritage: 0.7,
          diversity: 0.7,
          participation: 0.7,
        },
      });
    }
  }

  private async suggestEnvironmentalChanges(
    mood: DistrictMood,
    district: EnhancedDistrict
  ) {
    const suggestions = [];

    for (const tension of mood.tensionPoints) {
      switch (tension.cause) {
        case "high_noise_levels":
          suggestions.push({
            type: "noise_reduction",
            action: "implement_smart_sound_barriers",
            location: tension.location,
            priority: tension.intensity > 0.8 ? "high" : "medium",
          });
          break;
        case "overcrowding":
          suggestions.push({
            type: "space_optimization",
            action: "implement_ai_crowd_management",
            location: tension.location,
            priority: "high",
          });
          break;
        case "ai_interaction_friction":
          suggestions.push({
            type: "interaction_zone",
            action: "create_ai_human_interaction_spaces",
            location: tension.location,
            priority: "high",
          });
          break;
      }
    }

    return suggestions;
  }

  private async recommendCulturalActivities(
    mood: DistrictMood,
    district: EnhancedDistrict
  ) {
    const activities = [];

    // Base activities enhanced with AI integration
    activities.push({
      type: "ai_community_festival",
      frequency: "weekly",
      participation: "high",
      impact: "positive",
      aiInvolvement: "high",
    });

    if (district.aiMetrics.culturalIntegrationScore < 0.6) {
      activities.push({
        type: "ai_cultural_workshop",
        frequency: "daily",
        participation: "medium",
        impact: "transformative",
        aiInvolvement: "high",
      });
    }

    if (mood.harmonyScore < 0.5) {
      activities.push({
        type: "ai_harmony_workshop",
        frequency: "weekly",
        participation: "high",
        impact: "transformative",
        aiInvolvement: "medium",
      });
    }

    return activities;
  }
}

interface DistrictMood {
  districtId: string;
  dominantMood: string;
  tensionPoints: Array<{
    location: DistrictCoordinates;
    intensity: number;
    cause: string;
  }>;
  harmonyScore: number;
}
