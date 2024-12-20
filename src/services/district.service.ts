import { EventEmitter } from "events";
import { District, LocalEvent } from "../types/district.types";
import { CityService } from "./city.service";
import { VectorStoreService } from "./vector-store.service";
import { CityEvent } from "../types/city-events";
import { TransportHub } from "../types/transport.types";
import { TogetherService } from "./together.service";
import { VectorStoreType } from "../types/vector-store.types";

interface DistrictAnalytics {
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
    // Implementation depends on how you track population changes
    return [{ timestamp: Date.now(), count: district.population }];
  }

  private calculateAmbianceTrend(
    district: District
  ): "improving" | "stable" | "declining" {
    // Implementation depends on your ambiance tracking logic
    return "stable";
  }

  private calculateTransportUtilization(district: District): number {
    if (!district.transportHubs.length) return 0;
    return (
      district.transportHubs.reduce(
        (sum, hub) => sum + hub.currentUtilization,
        0
      ) / district.transportHubs.length
    );
  }

  private calculateTransportEfficiency(district: District): number {
    // Implementation depends on your transport metrics
    return 0.8;
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
    }>
  > {
    const districts = await this.getAllDistricts();
    return districts.map((district) => ({
      id: district.id,
      population: district.population,
      density: district.density,
      economicActivity: district.economicActivity,
      // ... other metrics
    }));
  }
}
