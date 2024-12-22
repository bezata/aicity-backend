import { EventEmitter } from "events";
import { CityMetrics } from "../types/city-metrics";
import { MetricsService } from "./metrics.service";
import { AgentCollaborationService } from "./agent-collaboration.service";
import { VectorStoreService } from "./vector-store.service";
import { DistrictService } from "./district.service";
import { AnalyticsService } from "./analytics.service";

interface MetricImpact {
  category: keyof CityMetrics;
  metric: string;
  change: number;
  duration: number; // in milliseconds
}

interface RandomEvent {
  id: string;
  title: string;
  description: string;
  severity: number;
  impacts: MetricImpact[];
  requiredAgents: string[];
  districtTypes: string[];
  priority: "low" | "medium" | "high" | "critical";
  cascadingEffects?: {
    probability: number;
    relatedEvents: string[];
    spreadPattern: "linear" | "exponential" | "clustered";
  };
  timeContext: {
    preferredTimeOfDay?: "morning" | "afternoon" | "evening" | "night";
    weatherSensitive: boolean;
    seasonalFactor?: "summer" | "winter" | "spring" | "fall";
  };
}

// Add this type to handle event types
type CityEventType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport"
  | "city_event";

// Add this interface for secondary events
interface SecondaryEvent {
  title: string;
  description: string;
  severity: number;
  impacts: MetricImpact[];
  requiredAgents: string[];
}

// Update the type definition
type VectorStoreType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport";

// Add helper type for metric updates
type MetricUpdates = {
  sustainability?: {
    carbonEmissions?: number;
    renewableEnergyRatio?: number;
    greenSpaceIndex?: number;
    airQualityIndex?: number;
    waterQualityScore?: number;
    biodiversityIndex?: number;
  };
  economy?: {
    employmentRate?: number;
    giniCoefficient?: number;
    businessFormationRate?: number;
    innovationIndex?: number;
    housingAffordability?: number;
  };
  social?: {
    healthcareAccessScore?: number;
    educationQualityIndex?: number;
    culturalEngagement?: number;
    civicParticipation?: number;
    communityWellbeing?: number;
  };
  infrastructure?: {
    trafficCongestion?: number;
    publicTransitReliability?: number;
    wasteRecyclingRate?: number;
    infrastructureHealth?: number;
    smartGridEfficiency?: number;
  };
  safety?: {
    crimeRate?: number;
    emergencyResponseTime?: number;
    publicTrustIndex?: number;
    disasterReadiness?: number;
  };
};

export class CityEventsService extends EventEmitter {
  private activeEvents: Map<string, RandomEvent> = new Map();

  constructor(
    private metricsService: MetricsService,
    private collaborationService: AgentCollaborationService,
    private vectorStore: VectorStoreService,
    private districtService: DistrictService,
    private analyticsService: AnalyticsService
  ) {
    super();
    this.initializeService();
  }

  private initializeService() {
    this.startRandomEventGenerator();

    // Track new events
    this.on("eventCreated", (event) => {
      this.analyticsService.trackInteraction(
        { id: event.id, type: "city_event" } as any,
        {
          type: "event",
          content: event.description,
          sentiment: event.impact > 0 ? 0.7 : 0.3,
          topics: ["city_event", event.category, event.type],
        } as any
      );
    });

    // Track event resolutions
    this.on("eventResolved", (event) => {
      this.analyticsService.trackInteraction(
        { id: event.id, type: "city_event" } as any,
        {
          type: "resolution",
          content: `Event resolved: ${event.description}`,
          sentiment: 0.8,
          topics: ["resolution", event.category, "success"],
        } as any
      );
    });

    // Track event impacts
    this.on("eventImpactAssessed", (assessment) => {
      this.analyticsService.trackInteraction(
        { id: assessment.eventId, type: "city_event" } as any,
        {
          type: "impact",
          content: `Impact assessment: ${assessment.description}`,
          sentiment: assessment.score,
          topics: ["impact", assessment.category, "assessment"],
        } as any
      );

      // Track city mood based on event impact
      this.analyticsService.trackMood(assessment.score);
    });
  }

  private async startRandomEventGenerator() {
    setInterval(() => {
      if (Math.random() < 0.3) {
        // 30% chance every interval
        this.generateRandomEvent();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private async generateRandomEvent(customEvent?: RandomEvent) {
    const event = customEvent || this.selectRandomEvent();
    const affectedDistrict = await this.selectAffectedDistrict(event);

    await this.vectorStore.upsert({
      id: `event-${event.id}`,
      values: await this.vectorStore.createEmbedding(
        `${event.title} ${event.description} priority:${event.priority} ` +
          `district:${affectedDistrict.name} time:${event.timeContext.preferredTimeOfDay}`
      ),
      metadata: {
        type: "district" as VectorStoreType,
        eventId: event.id,
        priority: event.priority,
        districtId: affectedDistrict.id,
        timestamp: Date.now(),
        cascading: !!customEvent,
      },
    });

    // Apply immediate impact on metrics with proper typing
    const metricUpdates: MetricUpdates = {};
    event.impacts.forEach((impact) => {
      const category = impact.category as keyof MetricUpdates;
      if (!metricUpdates[category]) {
        metricUpdates[category] = {};
      }
      const [_, metric] = impact.metric.split(".");
      (metricUpdates[category] as any)[metric] = impact.change;
    });

    await this.metricsService.updateMetrics(
      metricUpdates as Partial<CityMetrics>
    );

    // Handle cascading effects
    await this.handleCascadingEffects(event);

    // Move required agents to affected district
    for (const agentId of event.requiredAgents) {
      await this.districtService.recordAgentVisit(affectedDistrict.id, agentId);
    }

    // Initiate agent collaboration
    await this.collaborationService.initiateCollaboration({
      id: event.id,
      title: event.title,
      description: event.description,
      category: "emergency",
      severity: event.severity,
      duration: Math.max(...event.impacts.map((i) => i.duration)),
      urgency: event.severity,
      impact: {
        environmental: 0.7,
        social: 0.8,
        economic: 0.6,
      },
      requiredAgents: event.requiredAgents,
      affectedDistricts: [affectedDistrict.id],
      timestamp: Date.now(),
      status: "pending",
    });

    this.emit("eventGenerated", event);
  }

  private async selectAffectedDistrict(event: RandomEvent) {
    const districts = await this.districtService.getAllDistricts();

    if (!districts || districts.length === 0) {
      console.warn("No districts available in the system");
      throw new Error("No districts available");
    }

    // Query vector store for relevant district based on event context
    const query = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `${event.title} ${event.description}`
      ),
      filter: {
        type: { $eq: "district_context" },
      },
      topK: 1,
    });

    if (query.matches && query.matches.length > 0) {
      const districtId = query.matches[0].metadata.districtId;
      const matchedDistrict = districts.find((d) => d.id === districtId);
      if (matchedDistrict) {
        return matchedDistrict;
      }
    }

    // If no matching district found or vector search failed, select a random district
    const randomIndex = Math.floor(Math.random() * districts.length);
    return districts[randomIndex];
  }

  private selectRandomEvent(): RandomEvent {
    const events: RandomEvent[] = [
      {
        id: crypto.randomUUID(),
        title: "Smart Grid Fluctuation",
        description:
          "Energy grid showing unusual patterns in renewable integration",
        severity: 0.7,
        priority: "high",
        impacts: [
          {
            category: "infrastructure",
            metric: "smartGridEfficiency",
            change: -0.3,
            duration: 3 * 60 * 60 * 1000,
          },
          {
            category: "sustainability",
            metric: "renewableEnergyRatio",
            change: -0.2,
            duration: 3 * 60 * 60 * 1000,
          },
        ],
        requiredAgents: ["raj", "olivia"],
        districtTypes: ["residential", "commercial"],
        timeContext: {
          preferredTimeOfDay: "afternoon",
          weatherSensitive: true,
          seasonalFactor: "summer",
        },
      },
      {
        id: crypto.randomUUID(),
        title: "Cultural District Unrest",
        description:
          "Community tensions rising over heritage building renovation",
        severity: 0.6,
        priority: "medium",
        impacts: [
          {
            category: "social",
            metric: "communityWellbeing",
            change: -0.4,
            duration: 12 * 60 * 60 * 1000,
          },
          {
            category: "economy",
            metric: "businessFormationRate",
            change: -0.2,
            duration: 24 * 60 * 60 * 1000,
          },
        ],
        requiredAgents: ["elena", "sophia"],
        districtTypes: ["mixed", "commercial"],
        cascadingEffects: {
          probability: 0.4,
          relatedEvents: ["protest", "media_coverage"],
          spreadPattern: "clustered",
        },
        timeContext: {
          preferredTimeOfDay: "morning",
          weatherSensitive: false,
          seasonalFactor: "spring",
        },
      },
      {
        id: crypto.randomUUID(),
        title: "Public Health Alert",
        description: "Unusual pattern of respiratory complaints in district",
        severity: 0.8,
        priority: "critical",
        impacts: [
          {
            category: "social",
            metric: "healthcareAccessScore",
            change: -0.3,
            duration: 48 * 60 * 60 * 1000,
          },
          {
            category: "sustainability",
            metric: "airQualityIndex",
            change: 200,
            duration: 24 * 60 * 60 * 1000,
          },
        ],
        requiredAgents: ["elena", "olivia", "raj"],
        districtTypes: ["residential", "mixed"],
        cascadingEffects: {
          probability: 0.6,
          relatedEvents: ["school_closure", "emergency_measures"],
          spreadPattern: "exponential",
        },
        timeContext: {
          preferredTimeOfDay: "morning",
          weatherSensitive: true,
          seasonalFactor: "winter",
        },
      },
    ];

    // Consider time of day and weather for event selection
    const currentHour = new Date().getHours();
    const timeOfDay =
      currentHour >= 5 && currentHour < 12
        ? "morning"
        : currentHour >= 12 && currentHour < 17
        ? "afternoon"
        : currentHour >= 17 && currentHour < 22
        ? "evening"
        : "night";

    // Filter events based on context
    const contextuallyRelevantEvents = events.filter((event) => {
      if (
        event.timeContext.preferredTimeOfDay &&
        event.timeContext.preferredTimeOfDay !== timeOfDay
      ) {
        return false;
      }
      // Add more contextual filtering here
      return true;
    });

    return contextuallyRelevantEvents.length > 0
      ? contextuallyRelevantEvents[
          Math.floor(Math.random() * contextuallyRelevantEvents.length)
        ]
      : events[Math.floor(Math.random() * events.length)];
  }

  async resolveEvent(eventId: string) {
    const event = this.activeEvents.get(eventId);
    if (!event) return;

    const metricUpdates: MetricUpdates = {};
    event.impacts.forEach((impact) => {
      const category = impact.category as keyof MetricUpdates;
      if (!metricUpdates[category]) {
        metricUpdates[category] = {};
      }
      const [_, metric] = impact.metric.split(".");
      (metricUpdates[category] as any)[metric] = 0;
    });

    await this.metricsService.updateMetrics(
      metricUpdates as Partial<CityMetrics>
    );
    this.activeEvents.delete(eventId);
    this.emit("eventResolved", eventId);
  }

  private async findAgentHomeDistrict(agentId: string) {
    // Fix the query by adding vector
    const embedding = await this.vectorStore.createEmbedding(
      `agent ${agentId} home district`
    );
    const query = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "agent_residence" },
        agentId: { $eq: agentId },
      },
      topK: 1,
    });

    if (query.matches.length > 0) {
      const districtId = query.matches[0].metadata.districtId;
      return this.districtService.getDistrict(districtId);
    }
    return null;
  }

  private async handleCascadingEffects(event: RandomEvent) {
    if (!event.cascadingEffects) return;

    if (Math.random() < event.cascadingEffects.probability) {
      for (const relatedEventType of event.cascadingEffects.relatedEvents) {
        // Create secondary events based on the spread pattern
        const delay =
          event.cascadingEffects.spreadPattern === "exponential"
            ? Math.random() * 60 * 60 * 1000 // Random delay up to 1 hour
            : 30 * 60 * 1000; // Fixed 30-minute delay for linear

        setTimeout(() => {
          this.generateSecondaryEvent(event, relatedEventType);
        }, delay);
      }
    }
  }

  private async generateSecondaryEvent(
    primaryEvent: RandomEvent,
    eventType: string
  ) {
    // Generate appropriate secondary events
    const secondaryEvent = this.createSecondaryEvent(primaryEvent, eventType);
    await this.generateRandomEvent(secondaryEvent);
  }

  private createSecondaryEvent(
    primaryEvent: RandomEvent,
    eventType: string
  ): RandomEvent {
    // Create a secondary event based on the primary event and type
    const baseEvent: RandomEvent = {
      id: crypto.randomUUID(),
      title: `${eventType} following ${primaryEvent.title}`,
      description: `Secondary event triggered by ${primaryEvent.description}`,
      severity: primaryEvent.severity * 0.8,
      priority: primaryEvent.priority,
      impacts: primaryEvent.impacts.map((impact) => ({
        ...impact,
        change: impact.change * 0.7,
        duration: impact.duration * 0.5,
      })),
      requiredAgents: primaryEvent.requiredAgents.slice(0, 2),
      districtTypes: primaryEvent.districtTypes,
      timeContext: {
        preferredTimeOfDay: primaryEvent.timeContext.preferredTimeOfDay,
        weatherSensitive: primaryEvent.timeContext.weatherSensitive,
        seasonalFactor: primaryEvent.timeContext.seasonalFactor,
      },
    };

    return baseEvent;
  }

  async getActiveEvents(): Promise<any[]> {
    // Implementation
    return [];
  }

  async getCurrentEvents(): Promise<string[]> {
    const activeEvents = await this.getActiveEvents();
    return activeEvents.map((event) => event.title);
  }
}
