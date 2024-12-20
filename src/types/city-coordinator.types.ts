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
  domain: DomainType;
  title: string;
  description: string;
  impact: {
    metrics: Partial<CityMetrics>;
    priority: number; // 0-1
    timeframe: number; // days
    cost: number; // currency
  };
  requirements: {
    resources: string[];
    dependencies: string[]; // other proposal IDs
    approvals: string[]; // department IDs
  };
  simulation: {
    confidence: number; // 0-1
    risks: string[];
    alternatives: string[];
  };
  status:
    | "proposed"
    | "simulating"
    | "approved"
    | "rejected"
    | "implementing"
    | "completed";
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
