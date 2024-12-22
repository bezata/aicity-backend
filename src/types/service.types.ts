import { Metadata, QueryResult } from "./ai-integration.types";

export interface MetricsService {
  getMetrics(): Promise<any>;
  updateMetrics(metrics: any): Promise<void>;
}

export interface TogetherService {
  generateCompletion(prompt: string): Promise<{
    text: string;
    analysis?: {
      complexity: number;
      impact: number;
      shortTerm: string;
      mediumTerm: string;
      longTerm: string;
    };
  }>;
}

export interface AnalyticsService {
  trackEvent(eventName: string, data: any): void;
  getUserAnalytics(userId: string): Promise<any>;
  trackMood(mood: number): void;
  trackInteraction(entity: any, interaction: any): void;
}

export interface VectorMetadata {
  type: string;
  context?: any;
  timestamp: number;
  patternId?: string;
  agentId?: string;
  protocol?: string;
  state?: any;
}

export interface VectorStoreService {
  createEmbedding(content: string): Promise<number[]>;
  upsert(record: {
    id: string;
    values: number[];
    metadata: Metadata;
  }): Promise<{ success: boolean; id: string }>;
  query(params: {
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
  }): Promise<QueryResult>;
  deleteAll(): Promise<void>;
}
