export interface AIDecisionContext {
  confidence: number;
  factors: string[];
  alternatives: string[];
  impact: {
    social: number;
    economic: number;
    environmental: number;
  };
  timeframe: string;
}

export interface AIInteractionProtocol {
  type: "direct" | "assisted" | "automated";
  complexity: number;
  userPreference: string;
  adaptationLevel: number;
  lastInteraction: Date;
  successRate: number;
}

export interface CityPattern {
  id: string;
  type: string;
  confidence: number;
  frequency: number;
  impact: number;
  relatedPatterns: string[];
  firstObserved: Date;
  lastObserved: Date;
  predictions: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
  };
}

export interface VectorQuery {
  vector: number[];
  filter?: {
    [key: string]: {
      $eq?: string | number | boolean;
      $ne?: string | number | boolean;
      $gt?: number;
      $gte?: number;
      $lt?: number;
      $lte?: number;
      $in?: (string | number)[];
      $nin?: (string | number)[];
      $exists?: boolean;
    };
  };
  topK: number;
}

export interface VectorMetadata {
  type: string;
  context?: any;
  timestamp: number;
  patternId?: string;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: Partial<VectorMetadata>;
}

export interface AIAnalysis {
  complexity: number;
  impact: number;
  shortTerm: string;
  mediumTerm: string;
  longTerm: string;
}

export interface AIServiceResponse {
  text: string;
  analysis?: AIAnalysis;
}
