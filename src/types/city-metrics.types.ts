export interface CityMetrics {
  carbonEmissions: number;
  energyRatio: number;
  timestamp: number;
  economy: {
    employmentRate: number;
    jobGrowth: number;
    giniCoefficient: number;
    businessFormationRate: number;
    affordabilityIndex: number;
  };
}

export interface MetricsUpdate {
  type: "carbon" | "energy" | "economy" | "full";
  metrics: Partial<CityMetrics>;
  source: string;
}

export interface MetricsContext {
  environmental?: {
    carbonEmissions: number;
    energyRatio: number;
  };
  economic?: {
    employmentRate: number;
    jobGrowth: number;
    giniCoefficient: number;
  };
  previousMessages?: any[];
}

export type MetricsSubscriber = (update: MetricsUpdate) => void;
