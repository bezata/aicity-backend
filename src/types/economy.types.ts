export interface MarketMetrics {
  businessActivity: number;
  jobMarket: number;
  propertyValues: number;
  investmentFlow: number;
  consumerConfidence: number;
}

export interface EconomicIndicators {
  gdp: number;
  inflation: number;
  unemployment: number;
  economicGrowth: number;
  marketStability: number;
}

export interface BusinessActivity {
  id: string;
  type:
    | "retail"
    | "service"
    | "manufacturing"
    | "technology"
    | "cultural"
    | "ai_services"
    | "data_processing";
  districtId: string;
  revenue: number;
  employment: number;
  growth: number;
  stability: number;
  culturalImpact: number;
  aiIntegration?: number;
  dataUtilization?: number;
}

export interface PropertyMarket {
  districtId: string;
  residentialValue: number;
  commercialValue: number;
  developmentPotential: number;
  culturalSignificance: number;
  marketTrend: "rising" | "stable" | "declining";
}

export interface JobMarket {
  districtId: string;
  openPositions: number;
  skillsDemand: Record<string, number>;
  averageSalary: number;
  employmentRate: number;
  jobCreationRate: number;
}

export interface Investment {
  id: string;
  type: "infrastructure" | "business" | "cultural" | "technology";
  amount: number;
  districtId: string;
  expectedReturn: number;
  culturalValue: number;
  socialImpact: number;
}
