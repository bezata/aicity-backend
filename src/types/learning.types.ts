export interface LearningData {
  successPatterns: Array<{
    pattern: string;
    impact: number;
    replicability: number;
  }>;
  failurePoints: Array<{
    issue: string;
    frequency: number;
    severity: number;
  }>;
  emergingNeeds: string[];
  adaptationOpportunities: Array<{
    area: string;
    potential: number;
    cost: number;
  }>;
}

export interface AdaptationPlan {
  infrastructureChanges: Array<{
    type: "upgrade" | "new" | "remove";
    target: string;
    priority: number;
    estimatedImpact: number;
    cost: number;
  }>;
  serviceImprovements: Array<{
    service: string;
    changes: string[];
    expectedBenefit: number;
    implementation: string;
  }>;
  newFeatures: Array<{
    name: string;
    description: string;
    requirements: string[];
    impact: number;
  }>;
}

export interface DomainInsight {
  metrics: Record<string, number>;
  trends: {
    growth: number;
    efficiency: number;
    utilization: number;
    satisfaction: number;
  };
  recommendations: Array<{
    type: string;
    priority: "high" | "medium" | "low";
    description: string;
  }>;
}

export interface LearningMetrics {
  totalEvents: number;
  domainCoverage: number;
  lastEvolution: number;
  adaptationRate: number;
  confidenceLevel: number;
  domains: Record<
    string,
    {
      eventCount: number;
      lastEvent: number;
      patterns: Array<{
        pattern: string;
        impact: number;
        replicability: number;
      }>;
    }
  >;
}

export interface LearningRecommendations {
  immediate: Array<{
    type: "high-priority";
    area: string;
    potential: number;
    cost: number;
  }>;
  planned: Array<{
    type: "planned";
    area: string;
    potential: number;
    cost: number;
  }>;
  emergingNeeds: string[];
}
