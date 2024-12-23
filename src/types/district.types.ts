import { CityEventCategory } from "./city-events";

export type DistrictType =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed";

export type ReligiousZoneType =
  | "mosque"
  | "church"
  | "temple"
  | "synagogue"
  | "interfaith_center";

export type CulturalDistrictType =
  | "mixed"
  | "religious"
  | "historical"
  | "artistic";

export type ZoneStatus = "active" | "under_construction" | "planned";

export type EventType = CityEventCategory;

export interface Facility {
  type: string;
  name: string;
  purpose: string;
}

export interface Activity {
  name: string;
  schedule: string;
  participation: number;
}

export interface ReligiousZone {
  id: string;
  name: string;
  type: ReligiousZoneType;
  districtId: string;
  capacity: number;
  status: ZoneStatus;
  coordinates: [number, number];
  location: {
    coordinates: [number, number];
    area: number;
  };
  facilities: Facility[];
  activities: Activity[];
  metrics: {
    attendance: number;
    communityEngagement: number;
    culturalImpact: number;
    socialHarmony: number;
  };
  culturalMetrics: {
    communityEngagement: number;
    interfaithDialogue: number;
    culturalPreservation: number;
    socialImpact: number;
  };
}

export interface CulturalSite {
  id: string;
  name: string;
  type: string;
  status: ZoneStatus;
  coordinates: [number, number];
  metrics: {
    visitorCount: number;
    eventFrequency: number;
    culturalImpact: number;
    communityEngagement: number;
  };
}

export interface CulturalDistrict {
  id: string;
  name: string;
  type: CulturalDistrictType;
  districtId: string;
  zones: ReligiousZone[];
  culturalSites: CulturalSite[];
  culturalEvents: string[];
  demographics: Record<string, number>;
  metrics: {
    diversity: number;
    preservation: number;
    engagement: number;
    harmony: number;
  };
}

export interface DistrictMetrics {
  socialMetrics: {
    index: number;
    communityEngagement: number;
    publicServices: number;
    culturalDiversity: number;
    socialCohesion: number;
  };
  economicMetrics: {
    index: number;
    businessActivity: number;
    employment: number;
    innovation: number;
    marketDynamics: number;
  };
  culturalMetrics: {
    index: number;
    events: number;
    heritage: number;
    diversity: number;
    participation: number;
  };
  environmentalMetrics: {
    index: number;
    sustainability: number;
    greenSpace: number;
    pollution: number;
    resourceEfficiency: number;
  };
  infrastructureMetrics: {
    index: number;
    maintenance: number;
    accessibility: number;
    smartIntegration: number;
    resilience: number;
  };
}

export interface District {
  id: string;
  name: string;
  type: DistrictType;
  population: number;
  boundaries: Array<[number, number]>;
  area: number;
  density: number;
  economicActivity: number;
  currentEvents: LocalEvent[];
  transportHubs: DistrictTransportHub[];
  residentAgents: string[];
  visitorAgents: string[];
  amenities: {
    schools: number;
    hospitals: number;
    parks: number;
    shops: number;
  };
  metrics: {
    safety: number;
    cleanliness: number;
    noise: number;
    crowding: number;
    ambiance: number;
    education: number;
    healthcare: number;
    environment: number;
    economicGrowth: number;
    propertyValues: number;
    businessActivity: number;
    infrastructureQuality: number;
    publicServiceAccess: number;
    transportEfficiency: number;
    culturalVibrancy: number;
    communityWellbeing: number;
    socialCohesion: number;
    energyEfficiency: number;
    greenSpaceCoverage: number;
    environmentalHealth: number;
  };
  socialMetrics: {
    communityEngagement: number;
    culturalDiversity: number;
    socialCohesion: number;
    publicServices: number;
    index: number;
  };
  economicMetrics: {
    employmentRate: number;
    averageIncome: number;
    businessActivity: number;
    employment: number;
    index: number;
  };
}

export interface LocalEvent {
  id: string;
  type: string;
  name: string;
  description: string;
  category: "environmental" | "social" | "economic" | "cultural";
  startTime: number;
  endTime: number;
  urgency: number;
  impact: {
    type: string;
    severity: number;
    radius: number;
    environmental: number;
    social: number;
    economic: number;
  };
  location: [number, number];
  status: "pending" | "in_progress" | "resolved";
  affectedDistricts: string[];
  propagationProbability: number;
  resolution?: {
    actions: string[];
    outcome: string;
    responsibleAgent: string;
  };
}

export interface DistrictTransportHub {
  id: string;
  type: string;
  capacity: number;
  currentUtilization: number;
  status: "active" | "inactive" | "maintenance";
  lastMaintenance: number;
  schedule?: {
    weekday: string[];
    weekend: string[];
    holidays: string[];
  };
}

export interface DistrictEvent {
  districtId: string;
  type: string;
  success?: boolean;
  impact?: number;
  metrics?: {
    socialCohesion?: number;
    economicActivity?: number;
    environmentalHealth?: number;
  };
  timestamp?: number;
}
