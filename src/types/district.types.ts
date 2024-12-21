import { CityEventCategory } from "./city-events";
import { TransportHub } from "./transport.types";

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
  density: number;
  economicActivity: number;
  coordinates: [number, number];
  currentEvents: LocalEvent[];
  transportHubs: TransportHub[];
  residentAgents: string[];
  visitorAgents: string[];
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
  schedules: string[];
}

export interface LocalEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  category: CityEventCategory;
  severity: number;
  timestamp: number;
  duration: number;
  urgency: number;
  impact: {
    environmental: number;
    social: number;
    economic: number;
  };
  affectedDistricts: string[];
  requiredAgents: string[];
  status: "pending" | "in_progress" | "resolved";
  propagationProbability: number;
  resolution?: {
    actions: string[];
    outcome: string;
    responsibleAgent: string;
  };
}

export interface DistrictMetrics {
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
}
