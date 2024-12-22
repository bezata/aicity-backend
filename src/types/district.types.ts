import { CityEventCategory } from "./city-events";

export type DistrictType =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed";

export type EventType = CityEventCategory;

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
    // Safety & Environment
    safety: number;
    cleanliness: number;
    noise: number;
    crowding: number;
    ambiance: number;
    education: number;
    healthcare: number;
    environment: number;

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
