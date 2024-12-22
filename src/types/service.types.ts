import { AIServiceResponse } from "./ai-integration.types";

export interface MetricsService {
  getMetrics(): Promise<any>;
  getCurrentMetrics(): Promise<any>;
  getAllMetrics(): Promise<any>;
  getMetricsForPattern(patternType: string): Promise<any>;
}

export interface TogetherService {
  generateCompletion(prompt: string): Promise<AIServiceResponse>;
  generateAnalysis(input: string): Promise<AIServiceResponse>;
  generateText(prompt: string): Promise<string>;
  analyze(input: string): Promise<any>;
}

export interface AnalyticsService {
  getUserAnalytics(userId: string): Promise<any>;
  getUserMetrics(userId: string): Promise<any>;
  getMetrics(userId: string): Promise<any>;
}

export interface VectorStoreService {
  createEmbedding(text: string): Promise<number[]>;
  query(query: {
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
  }): Promise<{
    matches: Array<{
      id: string;
      score: number;
      metadata: any;
    }>;
  }>;
  upsert(record: {
    id: string;
    values: number[];
    metadata: {
      type: string;
      context?: any;
      timestamp: number;
      patternId?: string;
    };
  }): Promise<void>;
}
