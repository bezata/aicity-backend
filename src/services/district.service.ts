import { EventEmitter } from "events";
import {
  District,
  LocalEvent,
  DistrictTransportHub,
  DistrictType,
  ReligiousZoneType,
  CulturalDistrictType,
  ZoneStatus,
  ReligiousZone,
  CulturalDistrict,
} from "../types/district.types";
import { CityService } from "./city.service";
import { VectorStoreService } from "./vector-store.service";
import { CityEvent, CityEventCategory } from "../types/city-events";
import { TransportHub, TransportSchedule } from "../types/transport.types";
import { TogetherService } from "./together.service";
import { VectorStoreType } from "../types/vector-store.types";
import { AnalyticsService } from "./analytics.service";
import { DistrictCultureService } from "./district-culture.service";
import type { ServerWebSocket } from "bun";

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

interface DistrictConversation {
  id: string;
  participants: string[];
  location: string;
  topic: string;
  startTime: number;
  endTime?: number;
  sentiment: number;
  activity: string;
}

interface WebSocketData {
  districtId: string;
  lastActivity: number;
}

export class DistrictService extends EventEmitter {
  private districts: Map<string, District> = new Map();
  private districtConversations: Map<string, DistrictConversation[]> =
    new Map();

  private categoryMap: Record<
    CityEventCategory,
    "cultural" | "social" | "environmental" | "economic"
  > = {
    community: "social",
    emergency: "environmental",
    development: "economic",
    cultural: "cultural",
    social: "social",
    transport: "economic",
    environmental: "environmental",
  };

  // Track WebSocket connections per district
  private districtConnections: Map<string, ServerWebSocket<WebSocketData>[]> =
    new Map();

  constructor(
    private cityService: CityService,
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService,
    private analyticsService: AnalyticsService,
    private districtCultureService: DistrictCultureService
  ) {
    super();
    this.initializeService();
  }

  async initializeService() {
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

    // Initialize default districts if none exist
    const districts = await this.getAllDistricts();
    if (districts.length === 0) {
      await this.initializeDefaultDistricts();
    }
  }

  private async initializeDefaultDistricts() {
    const defaultDistricts = [
      {
        name: "Downtown District",
        type: "mixed" as DistrictType,
        population: 50000,
        boundaries: [
          [0, 0] as [number, number],
          [1, 0] as [number, number],
          [1, 1] as [number, number],
          [0, 1] as [number, number],
        ],
        area: 10,
        density: 5000,
        economicActivity: 0.8,
      },
      {
        name: "Cultural Heritage District",
        type: "mixed" as DistrictType,
        population: 30000,
        boundaries: [
          [1, 0] as [number, number],
          [2, 0] as [number, number],
          [2, 1] as [number, number],
          [1, 1] as [number, number],
        ],
        area: 8,
        density: 3750,
        economicActivity: 0.7,
      },

      {
        name: "Garden District",
        type: "residential" as DistrictType,
        population: 35000,
        boundaries: [
          [0, 1] as [number, number],
          [1, 1] as [number, number],
          [1, 2] as [number, number],
          [0, 2] as [number, number],
        ],
        area: 12,
        density: 2916,
        economicActivity: 0.6,
      },
      {
        name: "Industrial Park",
        type: "industrial" as DistrictType,
        population: 15000,
        boundaries: [
          [1, 1] as [number, number],
          [2, 1] as [number, number],
          [2, 2] as [number, number],
          [1, 2] as [number, number],
        ],
        area: 15,
        density: 1000,
        economicActivity: 0.85,
      },
    ];

    for (const districtData of defaultDistricts) {
      const district: District = {
        id: crypto.randomUUID(),
        ...districtData,
        currentEvents: [],
        transportHubs: [],
        residentAgents: [],
        visitorAgents: [],
        amenities: {
          schools: Math.floor(Math.random() * 5) + 1,
          hospitals: Math.floor(Math.random() * 3) + 1,
          parks: Math.floor(Math.random() * 6) + 2,
          shops: Math.floor(Math.random() * 50) + 20,
        },
        metrics: {
          safety: 0.8,
          cleanliness: 0.7,
          noise: 0.3,
          crowding: 0.4,
          ambiance: 0.7,
          education: 0.75,
          healthcare: 0.8,
          environment: 0.7,
          economicGrowth: 0.6,
          propertyValues: 0.7,
          businessActivity: 0.6,
          infrastructureQuality: 0.7,
          publicServiceAccess: 0.6,
          transportEfficiency: 0.7,
          culturalVibrancy: 0.8,
          communityWellbeing: 0.7,
          socialCohesion: 0.8,
          energyEfficiency: 0.7,
          greenSpaceCoverage: 0.6,
          environmentalHealth: 0.7,
        },
        socialMetrics: {
          communityEngagement: 0.7,
          culturalDiversity: 0.8,
          socialCohesion: 0.75,
          publicServices: 0.7,
          index: 0.75,
        },
        economicMetrics: {
          employmentRate: 0.85,
          averageIncome: 65000,
          businessActivity: 0.8,
          employment: 0.85,
          index: 0.8,
        },
      };

      await this.addDistrict(district);
    }

    // Initialize religious and cultural sites
    const religiousSites = [
      {
        districtId: "Downtown District",
        sites: [
          {
            name: "Central Cathedral",
            type: "church" as ReligiousZoneType,
            capacity: 1000,
          },
          {
            name: "Grand Mosque",
            type: "mosque" as ReligiousZoneType,
            capacity: 800,
          },
        ],
      },
      {
        districtId: "Cultural Heritage District",
        sites: [
          {
            name: "Historic Temple",
            type: "temple" as ReligiousZoneType,
            capacity: 500,
          },
          {
            name: "Heritage Synagogue",
            type: "synagogue" as ReligiousZoneType,
            capacity: 400,
          },
        ],
      },
      {
        districtId: "Garden District",
        sites: [
          {
            name: "Garden Temple",
            type: "temple" as ReligiousZoneType,
            capacity: 600,
          },
          {
            name: "Nature Shrine",
            type: "temple" as ReligiousZoneType,
            capacity: 300,
          },
        ],
      },
      {
        districtId: "University District",
        sites: [
          {
            name: "Interfaith Center",
            type: "interfaith_center" as ReligiousZoneType,
            capacity: 1200,
          },
          {
            name: "Campus Chapel",
            type: "interfaith_center" as ReligiousZoneType,
            capacity: 400,
          },
        ],
      },
    ];

    for (const location of religiousSites) {
      const district = (await this.getAllDistricts()).find(
        (d) => d.name === location.districtId
      );
      if (district) {
        for (const site of location.sites) {
          const coordinates = this.calculateDistrictCenter(district.boundaries);
          const religiousZone: Omit<ReligiousZone, "id"> = {
            name: site.name,
            type: site.type,
            districtId: district.id,
            capacity: site.capacity,
            status: "active" as ZoneStatus,
            coordinates,
            location: {
              coordinates,
              area: Math.floor(Math.random() * 1000) + 500, // Square meters
            },
            facilities: [
              {
                type: "prayer_hall",
                name: "Main Prayer Hall",
                purpose: "Primary worship space",
              },
              {
                type: "community_room",
                name: "Community Center",
                purpose: "Social gatherings and events",
              },
              {
                type: "education_room",
                name: "Study Room",
                purpose: "Religious education and study",
              },
            ],
            activities: [
              {
                name: "Weekly Service",
                schedule: "Every Sunday 10:00 AM",
                participation: 0.8,
              },
              {
                name: "Community Gathering",
                schedule: "Every Wednesday 6:00 PM",
                participation: 0.6,
              },
              {
                name: "Religious Education",
                schedule: "Every Saturday 2:00 PM",
                participation: 0.5,
              },
            ],
            metrics: {
              attendance: 0.7,
              communityEngagement: 0.8,
              culturalImpact: 0.75,
              socialHarmony: 0.9,
            },
            culturalMetrics: {
              communityEngagement: 0.85,
              interfaithDialogue: 0.8,
              culturalPreservation: 0.75,
              socialImpact: 0.9,
            },
          };
          await this.districtCultureService.createReligiousZone(religiousZone);
        }
      }
    }

    // Initialize cultural districts
    const culturalSites = [
      {
        districtId: "Arts District",
        type: "artistic" as CulturalDistrictType,
        sites: [
          { name: "Contemporary Art Museum", type: "Museum" },
          { name: "Performing Arts Center", type: "Theater" },
          { name: "Artists' Colony", type: "Cultural Center" },
        ],
      },
      {
        districtId: "Cultural Heritage District",
        type: "historical" as CulturalDistrictType,
        sites: [
          { name: "Heritage Museum", type: "Museum" },
          { name: "Traditional Arts Center", type: "Cultural Center" },
          { name: "Folk Music Hall", type: "Performance Venue" },
        ],
      },
      {
        districtId: "Downtown District",
        type: "mixed" as CulturalDistrictType,
        sites: [
          { name: "City Museum", type: "Museum" },
          { name: "Opera House", type: "Theater" },
          { name: "Cultural Exchange Center", type: "Cultural Center" },
        ],
      },
      {
        districtId: "Waterfront District",
        type: "mixed" as CulturalDistrictType,
        sites: [
          { name: "Maritime Museum", type: "Museum" },
          { name: "Waterfront Amphitheater", type: "Performance Venue" },
          { name: "Cultural Festival Plaza", type: "Cultural Center" },
        ],
      },
    ];

    for (const location of culturalSites) {
      const district = (await this.getAllDistricts()).find(
        (d) => d.name === location.districtId
      );
      if (district) {
        const coordinates = this.calculateDistrictCenter(district.boundaries);

        // Create religious zones for the cultural district
        const religiousZones: ReligiousZone[] = [
          {
            id: crypto.randomUUID(),
            name: "Cultural District Prayer Room",
            type: "interfaith_center",
            districtId: district.id,
            capacity: 100,
            status: "active",
            coordinates,
            location: {
              coordinates,
              area: Math.floor(Math.random() * 500) + 200,
            },
            facilities: [
              {
                type: "prayer_room",
                name: "Interfaith Prayer Room",
                purpose: "Multi-faith worship space",
              },
              {
                type: "meditation_room",
                name: "Meditation Room",
                purpose: "Quiet reflection and meditation",
              },
            ],
            activities: [
              {
                name: "Interfaith Prayer",
                schedule: "Daily 12:00 PM",
                participation: 0.5,
              },
              {
                name: "Meditation Session",
                schedule: "Every Tuesday 5:00 PM",
                participation: 0.4,
              },
            ],
            metrics: {
              attendance: 0.6,
              communityEngagement: 0.7,
              culturalImpact: 0.65,
              socialHarmony: 0.8,
            },
            culturalMetrics: {
              communityEngagement: 0.75,
              interfaithDialogue: 0.8,
              culturalPreservation: 0.7,
              socialImpact: 0.75,
            },
          },
        ];

        const culturalDistrict: Omit<CulturalDistrict, "id"> = {
          name: `${district.name} Cultural Zone`,
          type: location.type,
          districtId: district.id,
          zones: religiousZones,
          culturalSites: location.sites.map((site) => ({
            id: crypto.randomUUID(),
            name: site.name,
            type: site.type,
            status: "active" as ZoneStatus,
            coordinates,
            metrics: {
              visitorCount: Math.floor(Math.random() * 1000) + 500,
              eventFrequency: Math.floor(Math.random() * 10) + 5,
              culturalImpact: Math.random() * 0.3 + 0.7,
              communityEngagement: Math.random() * 0.3 + 0.7,
            },
          })),
          culturalEvents: [],
          demographics: {
            youth_population: Math.random() * 0.3 + 0.2,
            adult_population: Math.random() * 0.3 + 0.4,
            senior_population: Math.random() * 0.2 + 0.1,
            local_visitors: Math.random() * 0.4 + 0.4,
            domestic_visitors: Math.random() * 0.3 + 0.2,
            international_visitors: Math.random() * 0.2 + 0.1,
          },
          metrics: {
            diversity: 0.8,
            preservation: 0.75,
            engagement: 0.8,
            harmony: 0.85,
          },
        };
        await this.districtCultureService.createCulturalDistrict(
          culturalDistrict
        );
      }
    }
  }

  private calculateDistrictCenter(
    boundaries: Array<[number, number]>
  ): [number, number] {
    const x =
      boundaries.reduce((sum, coord) => sum + coord[0], 0) / boundaries.length;
    const y =
      boundaries.reduce((sum, coord) => sum + coord[1], 0) / boundaries.length;
    return [x, y];
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

    const event: LocalEvent = {
      id: crypto.randomUUID(),
      type: eventData.category!,
      name: eventData.title!,
      description: eventData.description!,
      category: this.categoryMap[eventData.category!] || "social",
      startTime: Date.now(),
      endTime: Date.now() + (eventData.duration || 3600000),
      urgency: eventData.urgency || eventData.severity! / 10,
      impact: {
        type: eventData.category!,
        severity: eventData.severity!,
        radius: 1000,
        environmental: eventData.impact?.environmental || 0,
        social: eventData.impact?.social || 0,
        economic: eventData.impact?.economic || 0,
      },
      location: [0, 0],
      status: "pending",
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

  async trackConversation(
    districtId: string,
    conversation: DistrictConversation
  ) {
    const conversations = this.districtConversations.get(districtId) || [];
    conversations.push(conversation);
    this.districtConversations.set(districtId, conversations);

    // Store in vector DB for analysis
    await this.vectorStore.upsert({
      id: `district-conversation-${conversation.id}`,
      values: await this.vectorStore.createEmbedding(
        `Conversation in district ${districtId}: ${conversation.topic} at ${conversation.location}`
      ),
      metadata: {
        type: "district_conversation",
        districtId,
        conversationId: conversation.id,
        location: conversation.location,
        activity: conversation.activity,
        sentiment: conversation.sentiment,
        timestamp: conversation.startTime,
      },
    });

    this.emit("conversationTracked", { districtId, conversation });
  }

  async getDistrictConversations(
    districtId: string,
    timeRange?: { start: number; end: number }
  ): Promise<DistrictConversation[]> {
    const conversations = this.districtConversations.get(districtId) || [];

    if (!timeRange) {
      return conversations;
    }

    return conversations.filter(
      (conv) =>
        conv.startTime >= timeRange.start && conv.startTime <= timeRange.end
    );
  }

  async getConversationAnalytics(districtId: string) {
    const conversations = await this.getDistrictConversations(districtId);

    return {
      totalConversations: conversations.length,
      averageSentiment:
        conversations.reduce((sum, conv) => sum + conv.sentiment, 0) /
        conversations.length,
      locationBreakdown: this.getLocationBreakdown(conversations),
      activityBreakdown: this.getActivityBreakdown(conversations),
      hourlyDistribution: this.getHourlyDistribution(conversations),
    };
  }

  private getLocationBreakdown(
    conversations: DistrictConversation[]
  ): Record<string, number> {
    return conversations.reduce((acc, conv) => {
      acc[conv.location] = (acc[conv.location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getActivityBreakdown(
    conversations: DistrictConversation[]
  ): Record<string, number> {
    return conversations.reduce((acc, conv) => {
      acc[conv.activity] = (acc[conv.activity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getHourlyDistribution(
    conversations: DistrictConversation[]
  ): number[] {
    const hourly = new Array(24).fill(0);
    conversations.forEach((conv) => {
      const hour = new Date(conv.startTime).getHours();
      hourly[hour]++;
    });
    return hourly;
  }

  public broadcastMessage(districtId: string, message: any) {
    console.log(`Broadcasting message to district ${districtId}:`, message);
    const connections = this.districtConnections.get(districtId);
    if (!connections) {
      console.log(`No connections found for district ${districtId}`);
      return;
    }

    const messageStr = JSON.stringify(message);
    console.log(
      `Found ${connections.length} connections for district ${districtId}`
    );

    for (const client of connections) {
      if (client.readyState === 1) {
        // OPEN
        console.log(`Sending message to client in district ${districtId}`);
        client.send(messageStr);
      } else {
        console.log(
          `Client in district ${districtId} not ready, state: ${client.readyState}`
        );
      }
    }
  }

  public addConnection(districtId: string, ws: ServerWebSocket<WebSocketData>) {
    console.log(`Adding connection for district ${districtId}`);
    if (!this.districtConnections.has(districtId)) {
      console.log(`Creating new connection array for district ${districtId}`);
      this.districtConnections.set(districtId, []);
    }
    this.districtConnections.get(districtId)!.push(ws);
    console.log(
      `Connection added. Total connections for district ${districtId}: ${
        this.districtConnections.get(districtId)!.length
      }`
    );
  }

  public removeConnection(
    districtId: string,
    ws: ServerWebSocket<WebSocketData>
  ) {
    const connections = this.districtConnections.get(districtId);
    if (!connections) return;

    const index = connections.indexOf(ws);
    if (index !== -1) {
      connections.splice(index, 1);
    }
  }

  private async upsertDistrictToVectorStore(district: District) {
    const districtDescription = `District ${district.name} (${district.type}): Population ${district.population}, Density ${district.density}, Economic Activity ${district.economicActivity}. 
    Metrics - Safety: ${district.metrics.safety}, Cleanliness: ${district.metrics.cleanliness}, Cultural Vibrancy: ${district.metrics.culturalVibrancy}
    Social Index: ${district.socialMetrics.index}, Economic Index: ${district.economicMetrics.index}`;

    await this.vectorStore.upsert({
      id: `district-${district.id}`,
      values: await this.vectorStore.createEmbedding(districtDescription),
      metadata: {
        type: "district",
        districtId: district.id,
        name: district.name,
        district_type: district.type,
        population: district.population,
        density: district.density,
        economic_activity: district.economicActivity,
        metrics: JSON.stringify(district.metrics),
        social_metrics: JSON.stringify(district.socialMetrics),
        economic_metrics: JSON.stringify(district.economicMetrics),
        timestamp: Date.now(),
      },
    });
  }

  async updateDistrictsFromData(districtsData: District[]) {
    console.log("Updating districts from data...");

    for (const districtData of districtsData) {
      // Update the districts Map
      this.districts.set(districtData.id, districtData);

      // Upsert to vector store
      await this.upsertDistrictToVectorStore(districtData);

      // Emit district updated event
      this.emit("districtUpdated", districtData);
    }

    console.log(`Updated ${districtsData.length} districts`);
    return Array.from(this.districts.values());
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
