import {
  CityEvent,
  CulturalEvent,
  DevelopmentProposal,
  EmergencyEvent,
  SocialEvent,
  TransportEvent,
} from "./city-events";
import { Agent } from "./agent.types";

export interface AgentConversationService {
  registerAgent(agent: Agent): Promise<void>;
  initiateConversation(
    agents: string[],
    context: any
  ): Promise<{
    topic: string;
    context: any;
  } | null>;
  getAgentInterests(agentId: string): Promise<string[]>;
  getAgentDevelopmentProposal(
    agentId: string,
    districtId: string
  ): Promise<DevelopmentProposal | null>;
}

export interface TransportService {
  transportAgent(
    agentId: string,
    fromDistrict: string | undefined,
    toDistrict: string
  ): Promise<TransportEvent>;
}

export interface CultureService {
  getDistrictCulture(districtId: string): Promise<any>;
  getDistrictCultureScore(
    districtId: string,
    interests: string[]
  ): Promise<number>;
  getCityMood(): Promise<{
    overall: number;
    dominantEmotion: string;
    factors: {
      community: number;
      stress: number;
    };
  }>;
}

export interface DevelopmentService {
  getDevelopmentStatus(): Promise<{
    projects: {
      active: number;
      completed: number;
      planned: number;
    };
    overallProgress: number;
    priorities: string[];
  }>;
}

export interface SocialDynamicsService {
  getDistrictDynamics(districtId: string): Promise<any>;
  getDistrictSocialScore(districtId: string): Promise<number>;
  calculateAgentCompatibility(agent1: string, agent2: string): Promise<number>;
  getCitySocialStatus(): Promise<{
    cohesion: number;
    activity: number;
    trends: string[];
  }>;
}

export interface CityCoordinatorService {
  getActiveDistricts(): Promise<
    Array<{
      id: string;
      name: string;
      population: number;
      status: string;
    }>
  >;
  getDistrictContext(districtId: string): Promise<{
    population: number;
    density: number;
    facilities: string[];
    currentEvents: any[];
  }>;
}

export interface WebSocketService {
  broadcast(event: string, data: any): void;
  getConnectedClients(): number;
}
