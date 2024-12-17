import { EventEmitter } from "events";
import type { District, LocalEvent } from "../types/district.types";
import { VectorStoreService } from "./vector-store.service";
import { CityService } from "./city.service";
import { scheduleJob } from "node-schedule";
import {
  CityEvent,
  CityEventCategory,
  cityEventTemplates,
} from "../types/city-events";
import { TransportSchedule, TransportEvent } from "../types/transport.types";
import { ChatMetadata } from "../types/conversation.types";

export class DistrictService extends EventEmitter {
  private districts: Map<string, District> = new Map();
  private transportSchedules: Map<string, TransportSchedule> = new Map();
  private vectorStore: VectorStoreService;

  constructor(
    private cityService: CityService,
    vectorStore: VectorStoreService
  ) {
    super();
    this.vectorStore = vectorStore;
  }

  async addEventToDistrict(districtId: string, event: CityEvent) {
    const district = this.districts.get(districtId);
    if (!district) throw new Error("District not found");

    const localEvent: LocalEvent = {
      ...event,
      propagationProbability: this.calculatePropagationProbability(event),
    };

    district.currentEvents.push(localEvent);
    this.emit("eventAdded", { districtId, event: localEvent });
  }

  private calculatePropagationProbability(event: CityEvent): number {
    // Base probability based on event severity
    let probability = event.severity;

    // Adjust based on event type
    switch (event.type) {
      case "emergency":
        probability *= 1.5;
        break;
      case "environmental":
        probability *= 1.3;
        break;
      default:
        probability *= 0.8;
    }

    // Ensure probability is between 0 and 1
    return Math.max(0, Math.min(1, probability));
  }

  private getDistrictContext(district: District): string {
    return `District: ${district.name}
Type: ${district.type}
Population: ${district.population}
Current Events: ${district.currentEvents.length}
Active Agents: ${district.activeAgents.length}
Contextual Factors:
- Noise: ${district.contextualFactors.noise}
- Crowding: ${district.contextualFactors.crowding}
- Safety: ${district.contextualFactors.safety}
- Cleanliness: ${district.contextualFactors.cleanliness}`;
  }

  private async propagateEvents() {
    for (const district of this.districts.values()) {
      for (const event of district.currentEvents) {
        if (Math.random() < event.propagationProbability) {
          const nearbyDistricts = this.getNearbyDistricts(district.id);
          for (const nearbyId of nearbyDistricts) {
            await this.addEventToDistrict(nearbyId, { ...event });
          }
        }
      }
    }
  }

  private getNearbyDistricts(districtId: string): string[] {
    // Implementation depends on your city layout
    return Array.from(this.districts.keys()).filter((id) => id !== districtId);
  }

  private async updateContextualFactors(district: District) {
    const timeOfDay = new Date().getHours();
    const events = district.currentEvents;

    district.contextualFactors = {
      noise: this.calculateNoiseFactor(district, timeOfDay),
      crowding: this.calculateCrowdingFactor(district, timeOfDay),
      safety: this.calculateSafetyFactor(district, events),
      cleanliness: this.calculateCleanlinessFactor(district, events),
    };
  }

  private calculateNoiseFactor(district: District, hour: number): number {
    let base = district.type === "industrial" ? 0.7 : 0.4;
    if (hour >= 7 && hour <= 19) base += 0.2;
    return Math.min(1, base + district.currentEvents.length * 0.1);
  }

  private calculateCrowdingFactor(district: District, hour: number): number {
    let base = district.type === "commercial" ? 0.6 : 0.3;
    if ((hour >= 8 && hour <= 10) || (hour >= 16 && hour <= 18)) base += 0.3;
    return Math.min(1, base + district.activeAgents.length * 0.01);
  }

  private calculateSafetyFactor(
    district: District,
    events: LocalEvent[]
  ): number {
    let base = 0.8;
    const emergencyEvents = events.filter((e) => e.type === "emergency");
    return Math.max(0, base - emergencyEvents.length * 0.2);
  }

  private calculateCleanlinessFactor(
    district: District,
    events: LocalEvent[]
  ): number {
    let base = 0.7;
    return Math.max(0, base - events.length * 0.05);
  }

  private async getDistrictEmbedding(district: District): Promise<number[]> {
    const context = this.getDistrictContext(district);
    return this.vectorStore.createEmbedding(context);
  }

  private selectRandomEventCategory(): CityEventCategory {
    return [
      "urban_development",
      "transportation",
      "environmental",
      "infrastructure",
      "community",
      "emergency",
      "cultural",
      "health",
      "education",
      "technology",
    ][Math.floor(Math.random() * 10)] as CityEventCategory;
  }

  private getRandomEventTemplate(category: CityEventCategory) {
    const templates = cityEventTemplates.find((t) => t.type === category);
    if (!templates) throw new Error(`No templates for category ${category}`);

    const template =
      templates.templates[
        Math.floor(Math.random() * templates.templates.length)
      ];
    return template;
  }

  private formatEventDescription(template: any, district: District): string {
    return template.description
      .replace("{location}", district.name)
      .replace("{type}", district.type);
  }

  getActiveTransport(districtId: string): TransportSchedule[] {
    return Array.from(this.transportSchedules.values()).filter(
      (schedule) =>
        schedule.currentLocation === districtId ||
        schedule.route.includes(districtId)
    );
  }

  getArrivalTime(transport: TransportSchedule, districtId: string): number {
    if (transport.currentLocation === districtId) return 0;

    const currentIndex = transport.route.indexOf(transport.currentLocation!);
    const targetIndex = transport.route.indexOf(districtId);

    if (currentIndex === -1 || targetIndex === -1) return -1;

    return Math.abs(targetIndex - currentIndex) * transport.schedule.frequency;
  }

  private async createEmbedding(text: string): Promise<number[]> {
    return this.vectorStore.createEmbedding(text);
  }
}
