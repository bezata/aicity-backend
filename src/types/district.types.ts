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
  ambiance: number;
  currentEvents: LocalEvent[];
  transportHubs: TransportHub[];
  contextualFactors: {
    noise: number;
    crowding: number;
    safety: number;
    cleanliness: number;
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
