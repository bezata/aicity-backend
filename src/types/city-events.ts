import { Agent } from "./agent.types";

export type CityEventCategory =
  | "community"
  | "emergency"
  | "development"
  | "cultural"
  | "social"
  | "transport"
  | "environmental";

export interface CityEvent {
  id: string;
  title: string;
  description: string;
  category: CityEventCategory;
  severity: number;
  urgency: number;
  duration: number;
  requiredAgents: string[];
  affectedDistricts: string[];
  impact: {
    social: number;
    economic: number;
    environmental: number;
    cultural?: number;
  };
}

export interface TransportEvent {
  agentId: string;
  from: string;
  to: string;
  method: string;
  duration: number;
  success: boolean;
}

export interface DevelopmentProposal {
  id: string;
  agentId: string;
  districtId: string;
  title: string;
  description: string;
  impact: number;
  category: string;
  resources: string[];
  timeline: number;
  supporters: string[];
}

export interface CulturalEvent {
  id: string;
  districtId: string;
  title: string;
  description: string;
  participants: string[];
  impact: number;
  duration: number;
  timestamp: number;
}

export interface EmergencyEvent {
  id: string;
  districtId: string;
  type: string;
  description: string;
  severity: number;
  resolved: boolean;
  responders: string[];
  timestamp: number;
}

export interface SocialEvent {
  id: string;
  districtId: string;
  type: string;
  description: string;
  participants: string[];
  impact: number;
  timestamp: number;
}
