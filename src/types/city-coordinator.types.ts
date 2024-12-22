export type DomainType =
  | "urban_planning"
  | "transportation"
  | "energy"
  | "water_waste"
  | "healthcare"
  | "education"
  | "economy"
  | "environmental"
  | "social_cohesion"
  | "law_enforcement";

export interface CityMetrics {
  sustainability: {
    carbonEmissions: number; // tons per capita
    renewableEnergyRatio: number; // 0-1
    greenSpaceIndex: number; // 0-1
    airQualityScore: number; // 0-100
    waterQualityScore: number; // 0-100
  };
  economy: {
    employmentRate: number; // 0-1
    jobGrowth: number; // percentage
    giniCoefficient: number; // 0-1
    businessFormationRate: number; // new businesses per 1000 residents
    affordabilityIndex: number; // 0-1 (housing cost vs median income)
  };
  social: {
    healthcareAccess: number; // 0-1
    educationQuality: number; // 0-1
    culturalEngagement: number; // 0-1
    civicParticipation: number; // 0-1
    communityWellbeing: number; // 0-1
  };
  infrastructure: {
    trafficCongestion: number; // 0-1
    publicTransitReliability: number; // 0-1
    wasteRecyclingRate: number; // 0-1
    infrastructureHealth: number; // 0-1
    housingAvailability: number; // 0-1
  };
}

export interface AgentProposal {
  id: string;
  title: string;
  description: string;
  category: "environmental" | "social" | "cultural" | "infrastructure";
  domain: DomainType;
  targetDistrict: string;
  stakeholders: string[];
  estimatedImpact: {
    overall: number;
    environmental?: number;
    social?: number;
    cultural?: number;
    economic?: number;
  };
  impact: {
    metrics: Record<string, number>;
    priority: number;
  };
  simulation: {
    confidence: number;
    results?: Record<string, any>;
  };
  requirements: {
    dependencies: string[];
    approvals: string[];
    resources?: string[];
  };
  location?: {
    coordinates: [number, number];
    landmark?: string;
  };
  status:
    | "proposed"
    | "simulating"
    | "approved"
    | "implementing"
    | "rejected"
    | "implemented"
    | "failed";
  timeline: {
    proposed: number;
    implemented?: number;
    completed?: number;
  };
  resources: {
    required: string[];
    allocated: string[];
  };
  metrics?: {
    success: number;
    efficiency: number;
    sustainability: number;
  };
}

export interface CoordinationEvent {
  type:
    | "proposal"
    | "simulation"
    | "approval"
    | "implementation"
    | "completion";
  timestamp: number;
  agentId: string;
  proposalId: string;
  details: Record<string, any>;
}
