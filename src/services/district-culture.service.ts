import { EventEmitter } from "events";
import { CultureService } from "./culture.service";
import { DistrictService } from "./district.service";
import { VectorStoreService } from "./vector-store.service";
import { District, DistrictMetrics } from "../types/district.types";

interface ReligiousZone {
  id: string;
  districtId: string;
  type: "mosque" | "church" | "temple" | "synagogue" | "interfaith_center";
  name: string;
  location: {
    coordinates: [number, number];
    area: number; // in square meters
  };
  capacity: number;
  status: "active" | "under_construction" | "planned";
  facilities: Array<{
    type: string;
    name: string;
    purpose: string;
  }>;
  activities: Array<{
    name: string;
    schedule: string;
    participation: number;
  }>;
  culturalMetrics: {
    communityEngagement: number;
    interfaithDialogue: number;
    culturalPreservation: number;
    socialImpact: number;
  };
}

interface CulturalDistrict {
  id: string;
  name: string;
  type: "religious" | "historical" | "artistic" | "mixed";
  zones: ReligiousZone[];
  demographics: Record<string, number>;
  culturalEvents: string[];
  metrics: {
    diversity: number;
    preservation: number;
    engagement: number;
    harmony: number;
  };
}

export class DistrictCultureService extends EventEmitter {
  private culturalDistricts: Map<string, CulturalDistrict> = new Map();
  private religiousZones: Map<string, ReligiousZone> = new Map();

  constructor(
    private cultureService: CultureService,
    private districtService: DistrictService,
    private vectorStore: VectorStoreService
  ) {
    super();
    this.initializeCulturalMapping();
  }

  private async initializeCulturalMapping() {
    // Map cultural events to districts
    this.cultureService.on(
      "culturalEventCreated",
      this.handleNewCulturalEvent.bind(this)
    );
    this.districtService.on(
      "districtUpdated",
      this.updateDistrictCulture.bind(this)
    );

    // Initialize religious zone monitoring
    setInterval(() => this.monitorReligiousZones(), 60 * 60 * 1000); // Hourly check
  }

  async createReligiousZone(
    zone: Omit<ReligiousZone, "id">
  ): Promise<ReligiousZone> {
    const newZone: ReligiousZone = {
      id: crypto.randomUUID(),
      ...zone,
    };

    await this.vectorStore.upsert({
      id: `religious-zone-${newZone.id}`,
      values: await this.vectorStore.createEmbedding(
        `${newZone.type} ${newZone.name} religious zone in district ${newZone.districtId}`
      ),
      metadata: {
        type: "district",
        subtype: "religious_zone",
        zoneId: newZone.id,
        districtId: newZone.districtId,
        zoneType: newZone.type,
        status: newZone.status,
      },
    });

    this.religiousZones.set(newZone.id, newZone);
    await this.updateCulturalDistrict(newZone.districtId);

    this.emit("religiousZoneCreated", newZone);
    return newZone;
  }

  async createCulturalDistrict(
    district: Omit<CulturalDistrict, "id">
  ): Promise<CulturalDistrict> {
    const newDistrict: CulturalDistrict = {
      id: crypto.randomUUID(),
      ...district,
    };

    this.culturalDistricts.set(newDistrict.id, newDistrict);
    await this.updateDistrictMetrics(newDistrict.id);

    this.emit("culturalDistrictCreated", newDistrict);
    return newDistrict;
  }

  private async handleNewCulturalEvent(event: any) {
    const district = await this.districtService.getDistrict(
      event.location.districtId
    );
    if (!district)
      throw new Error(`District not found: ${event.location.districtId}`);

    // Update district cultural metrics
    await this.districtService.updateMetrics(district.id, {
      culturalActivity: await this.calculateCulturalActivity(district, event),
      communityEngagement: await this.calculateCommunityEngagement(
        district,
        event
      ),
      religiousHarmony: await this.calculateReligiousHarmony(district, event),
    } as Partial<DistrictMetrics>);

    // Store cultural event context
    await this.vectorStore.upsert({
      id: `district-culture-${district.id}-${event.id}`,
      values: await this.vectorStore.createEmbedding(
        `${event.type} ${event.title} in ${district.name}`
      ),
      metadata: {
        type: "district",
        subtype: "cultural",
        districtId: district.id,
        eventId: event.id,
        culturalImpact: JSON.stringify(event.impact),
      },
    });

    // Update cultural district if exists
    const culturalDistrict = this.culturalDistricts.get(district.id);
    if (culturalDistrict) {
      culturalDistrict.culturalEvents.push(event.id);
      await this.updateDistrictMetrics(district.id);
    }
  }

  private async calculateCulturalActivity(
    district: any,
    event: any
  ): Promise<number> {
    const baseActivity = 0.8;
    const religiousZones = Array.from(this.religiousZones.values()).filter(
      (zone) => zone.districtId === district.id
    );

    const zoneImpact =
      religiousZones.reduce(
        (sum, zone) => sum + zone.culturalMetrics.communityEngagement,
        0
      ) / Math.max(religiousZones.length, 1);

    return (baseActivity + zoneImpact) / 2;
  }

  private async calculateCommunityEngagement(
    district: any,
    event: any
  ): Promise<number> {
    const baseEngagement = 0.7;
    const religiousZones = Array.from(this.religiousZones.values()).filter(
      (zone) => zone.districtId === district.id
    );

    const zoneEngagement =
      religiousZones.reduce(
        (sum, zone) => sum + zone.culturalMetrics.socialImpact,
        0
      ) / Math.max(religiousZones.length, 1);

    return (baseEngagement + zoneEngagement) / 2;
  }

  private async calculateReligiousHarmony(
    district: any,
    event: any
  ): Promise<number> {
    const religiousZones = Array.from(this.religiousZones.values()).filter(
      (zone) => zone.districtId === district.id
    );

    return (
      religiousZones.reduce(
        (sum, zone) => sum + zone.culturalMetrics.interfaithDialogue,
        0
      ) / Math.max(religiousZones.length, 1)
    );
  }

  private async monitorReligiousZones() {
    for (const zone of this.religiousZones.values()) {
      if (zone.status === "active") {
        await this.updateZoneMetrics(zone);
      }
    }
  }

  private async updateZoneMetrics(zone: ReligiousZone) {
    // Calculate metrics based on activities and participation
    const totalParticipation = zone.activities.reduce(
      (sum, activity) => sum + activity.participation,
      0
    );

    zone.culturalMetrics = {
      communityEngagement: Math.min(totalParticipation / zone.capacity, 1),
      interfaithDialogue: this.calculateInterfaithDialogue(zone),
      culturalPreservation: 0.9, // Base preservation score
      socialImpact: this.calculateSocialImpact(zone),
    };

    this.religiousZones.set(zone.id, zone);
    this.emit("zoneMetricsUpdated", zone);
  }

  private calculateInterfaithDialogue(zone: ReligiousZone): number {
    const interfaithActivities = zone.activities.filter(
      (activity) =>
        activity.name.toLowerCase().includes("interfaith") ||
        activity.name.toLowerCase().includes("dialogue")
    );

    return interfaithActivities.length > 0
      ? interfaithActivities.reduce(
          (sum, activity) => sum + activity.participation,
          0
        ) /
          (zone.capacity * interfaithActivities.length)
      : 0;
  }

  private calculateSocialImpact(zone: ReligiousZone): number {
    const communityActivities = zone.activities.filter(
      (activity) =>
        activity.name.toLowerCase().includes("community") ||
        activity.name.toLowerCase().includes("social")
    );

    return communityActivities.length > 0
      ? communityActivities.reduce(
          (sum, activity) => sum + activity.participation,
          0
        ) /
          (zone.capacity * communityActivities.length)
      : 0;
  }

  private async updateCulturalDistrict(districtId: string) {
    const district = this.culturalDistricts.get(districtId);
    if (!district) return;

    const zones = Array.from(this.religiousZones.values()).filter(
      (zone) => zone.districtId === districtId
    );

    district.zones = zones;
    await this.updateDistrictMetrics(districtId);
  }

  private async updateDistrictMetrics(districtId: string) {
    const district = this.culturalDistricts.get(districtId);
    if (!district) return;

    const activeZones = district.zones.filter(
      (zone) => zone.status === "active"
    );

    district.metrics = {
      diversity: this.calculateZoneDiversity(activeZones),
      preservation: this.calculatePreservationScore(activeZones),
      engagement: this.calculateDistrictEngagement(activeZones),
      harmony: this.calculateReligiousHarmonyScore(activeZones),
    };

    this.culturalDistricts.set(districtId, district);
    this.emit("districtMetricsUpdated", district);
  }

  private calculateZoneDiversity(zones: ReligiousZone[]): number {
    const uniqueTypes = new Set(zones.map((zone) => zone.type));
    return uniqueTypes.size / 5; // Normalized by maximum possible types
  }

  private calculatePreservationScore(zones: ReligiousZone[]): number {
    return (
      zones.reduce(
        (sum, zone) => sum + zone.culturalMetrics.culturalPreservation,
        0
      ) / Math.max(zones.length, 1)
    );
  }

  private calculateDistrictEngagement(zones: ReligiousZone[]): number {
    return (
      zones.reduce(
        (sum, zone) => sum + zone.culturalMetrics.communityEngagement,
        0
      ) / Math.max(zones.length, 1)
    );
  }

  private calculateReligiousHarmonyScore(zones: ReligiousZone[]): number {
    return (
      zones.reduce(
        (sum, zone) => sum + zone.culturalMetrics.interfaithDialogue,
        0
      ) / Math.max(zones.length, 1)
    );
  }

  async updateDistrictCulture(district: any) {
    const culturalDistrict = this.culturalDistricts.get(district.id);
    if (culturalDistrict) {
      await this.updateDistrictMetrics(district.id);
      this.emit("districtCultureUpdated", culturalDistrict);
    }
  }
}
