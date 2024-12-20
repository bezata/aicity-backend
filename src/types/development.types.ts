export interface DevelopmentProject {
  id: string;
  type:
    | "residential"
    | "commercial"
    | "industrial"
    | "infrastructure"
    | "greenspace";
  status: "proposed" | "approved" | "in_progress" | "completed" | "on_hold";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  scale: number;
  priority: number;
  sustainability: {
    energyEfficiency: number;
    greenScore: number;
    environmentalImpact: number;
  };
  timeline: {
    proposed: number;
    start?: number;
    estimatedCompletion?: number;
    completed?: number;
  };
  metrics: {
    costEfficiency: number;
    communityBenefit: number;
    economicGrowth: number;
    qualityOfLife: number;
  };
}

export interface GrowthAnalysis {
  populationTrends: {
    growth: number;
    density: number;
    distribution: Record<string, number>;
  };
  infrastructureNeeds: {
    utilization: number;
    bottlenecks: string[];
    expansionNeeds: string[];
  };
}
