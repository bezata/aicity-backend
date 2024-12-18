import { EventEmitter } from "events";
import { District, LocalEvent } from "../types/district.types";
import { CityService } from "./city.service";
import { VectorStoreService } from "./vector-store.service";
import { CityEvent } from "../types/city-events";
import { TransportHub } from "../types/transport.types";

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
    private vectorStore: VectorStoreService
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
      currentAmbiance: district.ambiance,
      ambianceTrend: this.calculateAmbianceTrend(district),
      transportUtilization: this.calculateTransportUtilization(district),
      transportEfficiency: this.calculateTransportEfficiency(district),
      noiseLevel: district.contextualFactors.noise,
      crowdingLevel: district.contextualFactors.crowding,
      safetyScore: district.contextualFactors.safety,
      cleanlinessScore: district.contextualFactors.cleanliness,
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
}
