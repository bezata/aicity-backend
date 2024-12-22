import { EventEmitter } from "events";
import {
  District,
  LocalEvent,
  DistrictTransportHub,
} from "../types/district.types";
import { CityService } from "./city.service";
import { VectorStoreService } from "./vector-store.service";
import { CityEvent, CityEventCategory } from "../types/city-events";
import { TransportHub, TransportSchedule } from "../types/transport.types";
import { TogetherService } from "./together.service";
import { VectorStoreType } from "../types/vector-store.types";
import { AnalyticsService } from "./analytics.service";

export interface DistrictAnalytics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventResolutionRate: number;
  populationTrends: Array<{ timestamp: number; count: number }>;
  currentAmbiance: number;
  ambianceTrend: "improving" | "stable" | "declining";
  transportUtilization: number;
  transportEfficiency: number;
  noiseLevel: number;
  crowdingLevel: number;
  safetyScore: number;
  cleanlinessScore: number;
}

export class DistrictService extends EventEmitter {
  private districts: Map<string, District> = new Map();

  constructor(
    private cityService: CityService,
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService,
    private analyticsService: AnalyticsService
  ) {
    super();
    this.initializeService();
  }

  initializeService() {
    // Track district mood changes
    this.on("moodChanged", (district) => {
      this.analyticsService.trackMood(district.metrics.ambiance);
    });

    // Track significant events
    this.on("eventAdded", (event) => {
      this.analyticsService.trackInteraction(
        { id: event.districtId, type: "district" } as any,
        {
          type: "event",
          content: event.description,
          sentiment: event.impact,
          topics: [event.category, "event", event.type],
        } as any
      );
    });
  }

  async getAllDistricts(): Promise<District[]> {
    return Array.from(this.districts.values());
  }

  async getDistrict(id: string): Promise<District | null> {
    return this.districts.get(id) || null;
  }

  async addEventToDistrict(
    id: string,
    eventData: Partial<CityEvent>
  ): Promise<LocalEvent> {
    const district = await this.getDistrict(id);
    if (!district) throw new Error("District not found");

    // Map CityEvent category to LocalEvent category
    const categoryMap: Record<CityEventCategory, LocalEvent["category"]> = {
      environmental: "environmental",
      cultural: "cultural",
      community: "social",
      urban_development: "economic",
      transportation: "economic",
      infrastructure: "economic",
      emergency: "environmental",
      health: "social",
      education: "social",
      technology: "economic",
    };

    const event: LocalEvent = {
      id: crypto.randomUUID(),
      type: eventData.category!,
      name: eventData.title!,
      description: eventData.description!,
      category: categoryMap[eventData.category!] || "social",
      startTime: eventData.timestamp || Date.now(),
      endTime:
        (eventData.timestamp || Date.now()) + (eventData.duration || 3600000),
      urgency: eventData.urgency || eventData.severity! / 10,
      impact: {
        type: eventData.category!,
        severity: eventData.severity!,
        radius: 1000, // Default radius of 1km
        environmental: eventData.impact?.environmental || 0,
        social: eventData.impact?.social || 0,
        economic: eventData.impact?.economic || 0,
      },
      location: [0, 0], // Will be updated with district center coordinates
      status: eventData.status || "pending",
      affectedDistricts: [id],
      propagationProbability: 0.5,
    };

    // Get district center coordinates
    const coordinates = await this.getDistrictCoordinates(id);
    if (coordinates) {
      event.location = coordinates;
    }

    district.currentEvents.push(event);
    this.emit("eventAdded", { districtId: id, event });

    // Store event in vector DB for analysis
    await this.vectorStore.upsert({
      id: `district-event-${event.id}`,
      values: await this.vectorStore.createEmbedding(
        `${event.type} event in district ${id}: ${event.description}`
      ),
      metadata: {
        type: "district" as VectorStoreType,
        districtId: id,
        eventId: event.id,
        category: event.category,
        severity: event.impact.severity,
        timestamp: event.startTime,
      },
    });

    return event;
  }

  async getDistrictAnalytics(id: string): Promise<DistrictAnalytics> {
    const district = await this.getDistrict(id);
    if (!district) throw new Error("District not found");

    const eventsByCategory = district.currentEvents.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const analytics = {
      totalEvents: district.currentEvents.length,
      eventsByCategory,
      eventResolutionRate: this.calculateResolutionRate(district),
      populationTrends: this.getPopulationTrends(district),
      currentAmbiance: district.metrics.ambiance,
      ambianceTrend: this.calculateAmbianceTrend(district),
      transportUtilization: this.calculateTransportUtilization(district),
      transportEfficiency: this.calculateTransportEfficiency(district),
      noiseLevel: district.metrics.noise,
      crowdingLevel: district.metrics.crowding,
      safetyScore: district.metrics.safety,
      cleanlinessScore: district.metrics.cleanliness,
    };

    // Track analytics
    this.analyticsService.trackInteraction(
      { id: district.id, type: "district" } as any,
      {
        type: "analytics",
        content: `District ${district.id} analytics retrieved`,
        sentiment: (analytics.safetyScore + analytics.cleanlinessScore) / 2,
        topics: ["district", "analytics", "metrics"],
      } as any
    );

    return analytics;
  }

  async addTransportHub(
    id: string,
    hubData: Partial<TransportHub>
  ): Promise<TransportHub> {
    const district = await this.getDistrict(id);
    if (!district) throw new Error("District not found");

    const hub: TransportHub = {
      id: crypto.randomUUID(),
      type: hubData.type!,
      capacity: hubData.capacity!,
      schedule: hubData.schedule || {
        weekday: [],
        weekend: [],
        holidays: [],
      },
      currentUtilization: 0,
      status: "active",
      lastMaintenance: Date.now(),
    };

    district.transportHubs.push(hub as DistrictTransportHub);
    this.emit("transportHubAdded", { districtId: id, hub });
    return hub;
  }

  private calculateResolutionRate(district: District): number {
    const resolvedEvents = district.currentEvents.filter(
      (event) => event.status === "resolved"
    ).length;
    return district.currentEvents.length > 0
      ? resolvedEvents / district.currentEvents.length
      : 1;
  }

  private getPopulationTrends(
    district: District
  ): Array<{ timestamp: number; count: number }> {
    const trends = [];
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Generate trend data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const timestamp = now - i * dayInMs;
      const basePopulation = district.population;
      const variation = Math.random() * 0.1 - 0.05; // ±5% variation

      trends.push({
        timestamp,
        count: Math.round(basePopulation * (1 + variation)),
      });
    }

    return trends;
  }

  private calculateAmbianceTrend(
    district: District
  ): "improving" | "stable" | "declining" {
    const factors = {
      noise: district.metrics.noise,
      crowding: district.metrics.crowding,
      cleanliness: district.metrics.cleanliness,
      safety: district.metrics.safety,
      culturalVibrancy: district.metrics.culturalVibrancy,
    };

    const score =
      Object.values(factors).reduce((sum, value) => sum + value, 0) / 5;

    if (score > 0.7) return "improving";
    if (score < 0.4) return "declining";
    return "stable";
  }

  private calculateTransportUtilization(district: District): number {
    if (!district.transportHubs.length) return 0;

    const utilization = district.transportHubs.reduce((sum, hub) => {
      const timeOfDay = new Date().getHours();
      const scheduleLoad = this.getScheduleLoad(hub.schedule, timeOfDay);
      return sum + hub.currentUtilization * scheduleLoad;
    }, 0);

    return utilization / district.transportHubs.length;
  }

  private getScheduleLoad(
    schedule: TransportSchedule | undefined,
    hour: number
  ): number {
    if (!schedule) return 0;

    // Peak hours: 7-9 AM and 5-7 PM
    const peakHours = [7, 8, 9, 17, 18, 19];
    const moderateHours = [10, 11, 12, 13, 14, 15, 16];

    const isWeekend = new Date().getDay() % 6 === 0;
    const scheduleToCheck = isWeekend ? schedule.weekend : schedule.weekday;

    if (!scheduleToCheck || scheduleToCheck.length === 0) return 0;

    if (peakHours.includes(hour)) return 1.5;
    if (moderateHours.includes(hour)) return 1.0;
    return 0.5;
  }

  private calculateTransportEfficiency(district: District): number {
    if (!district.transportHubs || district.transportHubs.length === 0) {
      return 0;
    }

    const totalUtilization = district.transportHubs.reduce(
      (sum: number, hub: DistrictTransportHub) => sum + hub.currentUtilization,
      0
    );

    return totalUtilization / district.transportHubs.length;
  }

  private calculateHubDensity(district: District): number {
    const area = this.calculateDistrictArea(district);
    return Math.min(1, district.transportHubs.length / (area * 0.1));
  }

  private calculateNetworkConnectivity(district: District): number {
    const connectedHubs = district.transportHubs.filter(
      (hub) => hub.status === "active" && this.hasValidConnections(hub)
    ).length;

    return connectedHubs / Math.max(district.transportHubs.length, 1);
  }

  private hasValidConnections(
    hub: TransportHub | DistrictTransportHub
  ): boolean {
    if (!hub.schedule) return false;

    const hasWeekday =
      Array.isArray(hub.schedule.weekday) && hub.schedule.weekday.length > 0;
    const hasWeekend =
      Array.isArray(hub.schedule.weekend) && hub.schedule.weekend.length > 0;

    return hasWeekday || hasWeekend;
  }

  private calculateMaintenanceStatus(district: District): number {
    const now = Date.now();
    return (
      district.transportHubs.reduce((sum, hub) => {
        const daysSinceLastMaintenance =
          (now - hub.lastMaintenance) / (1000 * 60 * 60 * 24);
        return sum + Math.max(0, 1 - daysSinceLastMaintenance / 30); // Assume monthly maintenance
      }, 0) / Math.max(district.transportHubs.length, 1)
    );
  }

  private calculateDistrictArea(district: District): number {
    // Simplified area calculation - could be more complex based on actual boundaries
    return 10; // Default area unit
  }

  async addDistrict(district: District): Promise<District> {
    this.districts.set(district.id, district);
    this.emit("districtAdded", district);
    return district;
  }

  async addResidentAgent(districtId: string, agentId: string) {
    const district = await this.getDistrict(districtId);
    if (!district) throw new Error("District not found");

    district.residentAgents.push(agentId);

    // Store in vector DB
    await this.vectorStore.upsert({
      id: `agent-residence-${agentId}`,
      values: await this.togetherService.createEmbedding(
        `Agent ${agentId} resides in district ${districtId}`
      ),
      metadata: {
        type: "agent_residence" as VectorStoreType,
        agentId,
        districtId,
        timestamp: Date.now(),
      },
    });
  }

  async recordAgentVisit(districtId: string, agentId: string) {
    const district = await this.getDistrict(districtId);
    if (!district) throw new Error("District not found");

    district.visitorAgents.push(agentId);

    // Store visit in vector DB
    await this.vectorStore.upsert({
      id: `agent-visit-${agentId}-${Date.now()}`,
      values: await this.togetherService.createEmbedding(
        `Agent ${agentId} visited district ${districtId}`
      ),
      metadata: {
        type: "agent_visit" as VectorStoreType,
        agentId,
        districtId,
        timestamp: Date.now(),
      },
    });
  }

  async getAllMetrics(): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      population: number;
      density: number;
      economicActivity: number;
      metrics: {
        // Social & Community
        safety: number;
        communityWellbeing: number;
        socialCohesion: number;
        publicServiceAccess: number;

        // Environment & Health
        cleanliness: number;
        noise: number;
        crowding: number;
        ambiance: number;
        environmentalHealth: number;

        // Culture & Development
        culturalVibrancy: number;
        economicGrowth: number;
        businessActivity: number;

        // Infrastructure & Services
        infrastructureQuality: number;
        transportEfficiency: number;
        energyEfficiency: number;
        greenSpaceCoverage: number;
      };
      detailedMetrics: DistrictMetrics;
    }>
  > {
    const districts = await this.getAllDistricts();
    const metricsPromises = districts.map(async (district) => {
      const detailedMetrics = await this.getDistrictMetrics(district.id);
      return {
        id: district.id,
        name: district.name,
        type: district.type,
        population: district.population,
        density: district.density,
        economicActivity: district.economicActivity,
        metrics: {
          // Social & Community
          safety: district.metrics.safety,
          communityWellbeing: district.metrics.communityWellbeing,
          socialCohesion: district.metrics.socialCohesion,
          publicServiceAccess: district.metrics.publicServiceAccess,

          // Environment & Health
          cleanliness: district.metrics.cleanliness,
          noise: district.metrics.noise,
          crowding: district.metrics.crowding,
          ambiance: district.metrics.ambiance,
          environmentalHealth: district.metrics.environmentalHealth,

          // Culture & Development
          culturalVibrancy: district.metrics.culturalVibrancy,
          economicGrowth: district.metrics.economicGrowth,
          businessActivity: district.metrics.businessActivity,

          // Infrastructure & Services
          infrastructureQuality: district.metrics.infrastructureQuality,
          transportEfficiency: district.metrics.transportEfficiency,
          energyEfficiency: district.metrics.energyEfficiency,
          greenSpaceCoverage: district.metrics.greenSpaceCoverage,
        },
        detailedMetrics: detailedMetrics || {
          socialMetrics: {
            index: 0.5,
            communityEngagement: 0.5,
            publicServices: 0.5,
            culturalDiversity: 0.5,
            socialCohesion: 0.5,
          },
          economicMetrics: {
            index: 0.5,
            businessActivity: 0.5,
            employment: 0.5,
            innovation: 0.5,
            marketDynamics: 0.5,
          },
          culturalMetrics: {
            index: 0.5,
            events: 0.5,
            heritage: 0.5,
            diversity: 0.5,
            participation: 0.5,
          },
          environmentalMetrics: {
            index: 0.5,
            sustainability: 0.5,
            greenSpace: 0.5,
            pollution: 0.5,
            resourceEfficiency: 0.5,
          },
          infrastructureMetrics: {
            index: 0.5,
            maintenance: 0.5,
            accessibility: 0.5,
            smartIntegration: 0.5,
            resilience: 0.5,
          },
        },
      };
    });

    return Promise.all(metricsPromises);
  }

  async updateMetrics(districtId: string, metrics: Partial<DistrictMetrics>) {
    const district = await this.getDistrict(districtId);
    if (!district) {
      throw new Error(`District not found: ${districtId}`);
    }

    // Get current metrics
    const currentMetrics = await this.getDistrictMetrics(districtId);
    if (!currentMetrics) {
      throw new Error(
        `Could not retrieve current metrics for district: ${districtId}`
      );
    }

    // Merge new metrics with current metrics
    const updatedMetrics: DistrictMetrics = {
      socialMetrics: {
        ...currentMetrics.socialMetrics,
        ...metrics.socialMetrics,
      },
      economicMetrics: {
        ...currentMetrics.economicMetrics,
        ...metrics.economicMetrics,
      },
      culturalMetrics: {
        ...currentMetrics.culturalMetrics,
        ...metrics.culturalMetrics,
      },
      environmentalMetrics: {
        ...currentMetrics.environmentalMetrics,
        ...metrics.environmentalMetrics,
      },
      infrastructureMetrics: {
        ...currentMetrics.infrastructureMetrics,
        ...metrics.infrastructureMetrics,
      },
    };

    // Store updated metrics in vector DB
    await this.vectorStore.upsert({
      id: `district-${districtId}-metrics-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `District ${district.name} metrics update: ` +
          `Social: ${updatedMetrics.socialMetrics.index}, ` +
          `Economic: ${updatedMetrics.economicMetrics.index}, ` +
          `Cultural: ${updatedMetrics.culturalMetrics.index}, ` +
          `Environmental: ${updatedMetrics.environmentalMetrics.index}, ` +
          `Infrastructure: ${updatedMetrics.infrastructureMetrics.index}`
      ),
      metadata: {
        type: "district_metrics" as VectorStoreType,
        districtId,
        socialMetrics: JSON.stringify(updatedMetrics.socialMetrics),
        economicMetrics: JSON.stringify(updatedMetrics.economicMetrics),
        culturalMetrics: JSON.stringify(updatedMetrics.culturalMetrics),
        environmentalMetrics: JSON.stringify(
          updatedMetrics.environmentalMetrics
        ),
        infrastructureMetrics: JSON.stringify(
          updatedMetrics.infrastructureMetrics
        ),
        timestamp: Date.now(),
      },
    });

    // Update district object
    const updatedDistrict = {
      ...district,
      metrics: {
        ...district.metrics,
        // Map metrics to district metrics structure
        safety: updatedMetrics.socialMetrics.index,
        cleanliness: updatedMetrics.environmentalMetrics.sustainability,
        noise: updatedMetrics.environmentalMetrics.pollution,
        crowding: updatedMetrics.infrastructureMetrics.accessibility,
        ambiance: updatedMetrics.culturalMetrics.index,
        culturalVibrancy: updatedMetrics.culturalMetrics.diversity,
        communityWellbeing: updatedMetrics.socialMetrics.communityEngagement,
        socialCohesion: updatedMetrics.socialMetrics.socialCohesion,
        economicGrowth: updatedMetrics.economicMetrics.index,
        businessActivity: updatedMetrics.economicMetrics.businessActivity,
        infrastructureQuality: updatedMetrics.infrastructureMetrics.maintenance,
        publicServiceAccess: updatedMetrics.socialMetrics.publicServices,
        transportEfficiency: updatedMetrics.infrastructureMetrics.accessibility,
        energyEfficiency:
          updatedMetrics.environmentalMetrics.resourceEfficiency,
        greenSpaceCoverage: updatedMetrics.environmentalMetrics.greenSpace,
        environmentalHealth: updatedMetrics.environmentalMetrics.index,
      },
    };

    this.districts.set(districtId, updatedDistrict);
    this.emit("districtUpdated", updatedDistrict);
    return updatedDistrict;
  }

  async getDistrictMetrics(
    districtId: string
  ): Promise<DistrictMetrics | null> {
    const district = await this.getDistrict(districtId);
    if (!district) return null;

    // Get metrics from vector store
    const results = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `district ${districtId} metrics`
      ),
      filter: {
        type: { $eq: "district_metrics" },
        districtId: { $eq: districtId },
      },
      topK: 1,
    });

    if (!results.matches?.length) {
      // Return default metrics if none found
      return {
        socialMetrics: {
          index: 0.5,
          communityEngagement: 0.5,
          publicServices: 0.5,
          culturalDiversity: 0.5,
          socialCohesion: 0.5,
        },
        economicMetrics: {
          index: 0.5,
          businessActivity: 0.5,
          employment: 0.5,
          innovation: 0.5,
          marketDynamics: 0.5,
        },
        culturalMetrics: {
          index: 0.5,
          events: 0.5,
          heritage: 0.5,
          diversity: 0.5,
          participation: 0.5,
        },
        environmentalMetrics: {
          index: 0.5,
          sustainability: 0.5,
          greenSpace: 0.5,
          pollution: 0.5,
          resourceEfficiency: 0.5,
        },
        infrastructureMetrics: {
          index: 0.5,
          maintenance: 0.5,
          accessibility: 0.5,
          smartIntegration: 0.5,
          resilience: 0.5,
        },
      };
    }

    return {
      socialMetrics: JSON.parse(results.matches[0].metadata.socialMetrics),
      economicMetrics: JSON.parse(results.matches[0].metadata.economicMetrics),
      culturalMetrics: JSON.parse(results.matches[0].metadata.culturalMetrics),
      environmentalMetrics: JSON.parse(
        results.matches[0].metadata.environmentalMetrics
      ),
      infrastructureMetrics: JSON.parse(
        results.matches[0].metadata.infrastructureMetrics
      ),
    };
  }

  async getDistrictCoordinates(
    districtId: string
  ): Promise<[number, number] | null> {
    try {
      const district = await this.getDistrict(districtId);
      if (
        !district ||
        !district.boundaries ||
        district.boundaries.length === 0
      ) {
        return null;
      }

      // Calculate the centroid of the district's boundaries
      const coordinates = district.boundaries.reduce(
        (acc: [number, number], coord: [number, number]) => {
          acc[0] += coord[0];
          acc[1] += coord[1];
          return acc;
        },
        [0, 0]
      );

      return [
        coordinates[0] / district.boundaries.length,
        coordinates[1] / district.boundaries.length,
      ];
    } catch (error) {
      console.error(
        `Failed to get coordinates for district ${districtId}:`,
        error
      );
      return null;
    }
  }
}

export interface DistrictMetrics {
  socialMetrics: {
    index: number; // Overall social index
    communityEngagement: number; // Level of community participation
    publicServices: number; // Access to and quality of public services
    culturalDiversity: number; // Diversity of cultural activities and representation
    socialCohesion: number; // Strength of social bonds and integration
  };
  economicMetrics: {
    index: number; // Overall economic index
    businessActivity: number; // Level of business operations and growth
    employment: number; // Employment rate and job availability
    innovation: number; // Rate of innovation and technological adoption
    marketDynamics: number; // Market health and economic resilience
  };
  culturalMetrics: {
    index: number; // Overall cultural index
    events: number; // Frequency and quality of cultural events
    heritage: number; // Preservation and celebration of heritage
    diversity: number; // Cultural diversity and inclusion
    participation: number; // Community participation in cultural activities
  };
  environmentalMetrics: {
    index: number; // Overall environmental index
    sustainability: number; // Environmental sustainability practices
    greenSpace: number; // Availability and quality of green spaces
    pollution: number; // Air and noise pollution levels
    resourceEfficiency: number; // Resource use and management efficiency
  };
  infrastructureMetrics: {
    index: number; // Overall infrastructure index
    maintenance: number; // Infrastructure maintenance and quality
    accessibility: number; // Accessibility of facilities and services
    smartIntegration: number; // Integration of smart city technologies
    resilience: number; // Infrastructure resilience to challenges
  };
}
