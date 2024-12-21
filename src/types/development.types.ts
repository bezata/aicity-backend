export interface DevelopmentProject {
  id: string;
  type: string;
  status: "proposed" | "approved" | "in_progress" | "completed";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  timeline: {
    proposed: number;
    approved?: number;
    started?: number;
    completed?: number;
  };
  metrics: {
    costEfficiency: number;
    communityBenefit: number;
    economicGrowth: number;
    qualityOfLife: number;
  };
  sustainability: {
    energyEfficiency: number;
    greenScore: number;
    environmentalImpact: number;
  };
  culturalImpact: {
    culturalPreservation: number;
    communityEngagement: number;
    touristAttraction: number;
    heritagePreservation?: number;
    culturalContinuity?: number;
    religiousConsideration?: number;
    preservation?: number;
    communityValue?: number;
    traditionalElements?: number;
  };
  communityImpact?: {
    accessibility: number;
    socialCohesion: number;
    localBenefit: number;
  };
  culturalFeatures?: {
    preservation: number;
    communityValue: number;
    traditionalElements: number;
    spaces: number;
    art: number;
    heritage: number;
  };
  aiMetrics?: {
    computationalDensity: number;
    dataAccessibility: number;
    processingEfficiency: number;
    interactionQuality: number;
    learningOpportunities: number;
  };
  environmentalMetrics?: {
    carbonEmissions: number;
    energyEfficiency: number;
    wasteManagement: number;
    resourceUtilization: number;
    sustainabilityScore: number;
  };
  agentActivity?: {
    interactionFrequency: number;
    collaborationScore: number;
    knowledgeSharing: number;
    innovationRate: number;
    adaptabilityScore: number;
  };
  budget?: number;
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
  environmentalConsiderations: {
    airQuality: number;
    greenCoverage: number;
    sustainability: number;
  };
  economicIndicators: {
    growth: number;
    sectors: Record<string, number>;
    investment: number;
  };
  aiGrowth?: {
    computationalExpansion: number;
    dataGrowth: number;
    interactionDensity: number;
    learningRate: number;
    adaptationSpeed: number;
  };
  environmentalTrends?: {
    emissionsTrend: number;
    energyEfficiencyTrend: number;
    resourceConsumptionTrend: number;
    sustainabilityTrend: number;
  };
  agentDevelopment?: {
    populationGrowth: number;
    complexityIncrease: number;
    collaborationTrend: number;
    innovationTrend: number;
  };
}
