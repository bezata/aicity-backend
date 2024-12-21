import { EventEmitter } from "events";
import { District, LocalEvent } from "../types/district.types";
import { CityService } from "./city.service";
import { VectorStoreService } from "./vector-store.service";
import { CityEvent } from "../types/city-events";
import { TransportHub, TransportSchedule } from "../types/transport.types";
import { TogetherService } from "./together.service";
import { VectorStoreType } from "../types/vector-store.types";

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
    private togetherService: TogetherService
  ) {
    super();
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
      title: eventData.title!,
      description: eventData.description!,
      category: eventData.category!,
      severity: eventData.severity!,
      timestamp: Date.now(),
      duration: eventData.duration!,
      urgency: eventData.severity! / 10,
      impact: eventData.impact!,
      affectedDistricts: [id],
      requiredAgents: eventData.requiredAgents!,
      status: "pending",
      propagationProbability: 0.5,
    };

    district.currentEvents.push(event);
    this.emit("eventAdded", { districtId: id, event });
    return event;
  }

  async getDistrictAnalytics(id: string): Promise<DistrictAnalytics> {
    const district = await this.getDistrict(id);
    if (!district) throw new Error("District not found");

    const eventsByCategory = district.currentEvents.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
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
      schedule: hubData.schedule!,
      currentUtilization: 0,
      status: "active",
      lastMaintenance: Date.now(),
    };

    district.transportHubs.push(hub);
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

  private getScheduleLoad(schedule: TransportSchedule, hour: number): number {
    // Peak hours: 7-9 AM and 5-7 PM
    const peakHours = [7, 8, 9, 17, 18, 19];
    const moderateHours = [10, 11, 12, 13, 14, 15, 16];

    const isWeekend = new Date().getDay() % 6 === 0;
    const scheduleToCheck = isWeekend ? schedule.weekend : schedule.weekday;

    if (peakHours.includes(hour)) return 1.5;
    if (moderateHours.includes(hour)) return 1.0;
    return 0.5;
  }

  private calculateTransportEfficiency(district: District): number {
    const baseEfficiency = 0.8;
    const factors = {
      hubDensity: this.calculateHubDensity(district),
      networkConnectivity: this.calculateNetworkConnectivity(district),
      maintenanceStatus: this.calculateMaintenanceStatus(district),
    };

    return (
      baseEfficiency *
      (factors.hubDensity * 0.3 +
        factors.networkConnectivity * 0.4 +
        factors.maintenanceStatus * 0.3)
    );
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

  private hasValidConnections(hub: TransportHub): boolean {
    return hub.schedule.weekday.length > 0 || hub.schedule.weekend.length > 0;
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
      population: number;
      density: number;
      economicActivity: number;
      metrics: {
        // Safety & Environment
        safety: number;
        cleanliness: number;
        noise: number;
        crowding: number;
        ambiance: number;

        // Economic & Development
        economicGrowth: number;
        propertyValues: number;
        businessActivity: number;

        // Infrastructure & Services
        infrastructureQuality: number;
        publicServiceAccess: number;
        transportEfficiency: number;

        // Social & Cultural
        culturalVibrancy: number;
        communityWellbeing: number;
        socialCohesion: number;

        // Sustainability
        energyEfficiency: number;
        greenSpaceCoverage: number;
        environmentalHealth: number;
      };
    }>
  > {
    const districts = await this.getAllDistricts();
    return districts.map((district) => ({
      id: district.id,
      population: district.population,
      density: district.density,
      economicActivity: district.economicActivity,
      metrics: district.metrics,
    }));
  }

  async updateMetrics(districtId: string, metrics: Partial<DistrictMetrics>) {
    const district = await this.getDistrict(districtId);
    if (!district) {
      throw new Error(`District not found: ${districtId}`);
    }

    const updatedDistrict = {
      ...district,
      metrics: {
        ...district.metrics,
        ...metrics,
      },
    };

    await this.vectorStore.upsert({
      id: `district-${districtId}-metrics-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `District ${district.name} metrics update`
      ),
      metadata: {
        type: "district",
        districtId,
        metrics: JSON.stringify(metrics),
        timestamp: Date.now(),
      },
    });

    this.districts.set(districtId, updatedDistrict);
    this.emit("districtUpdated", updatedDistrict);
    return updatedDistrict;
  }
}

export interface DistrictMetrics {
  // Cultural metrics
  culturalActivity?: number;
  communityEngagement?: number;
  religiousHarmony?: number;
  culturalDiversity?: number;
  heritagePreservation?: number;
  culturalVibrancy?: number;
  communityWellbeing?: number;
  socialCohesion?: number;
  // Social metrics
  communityParticipation?: number;
  interculturalDialogue?: number;
  noise?: number;
  cleanliness?: number;
  safety?: number;
  crowding?: number;
  ambiance?: number;

  // Infrastructure metrics
  culturalFacilities?: number;
  publicSpaces?: number;
  accessibility?: number;

  // Performance metrics
  eventFrequency?: number;
  visitorSatisfaction?: number;
  culturalImpact?: number;
}
