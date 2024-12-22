// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import {
  RecordMetadata,
  RecordMetadataValue,
} from "@pinecone-database/pinecone";
import { TogetherService } from "./together.service";
import { VectorStoreType } from "../types/vector-store.types";
import type { ConversationStyle } from "../types/common.types";
import type { Message } from "../types/conversation.types";

// Base metadata interface that follows Pinecone's requirements
export interface BaseMetadata {
  record_type: string;
  timestamp: number;
  [key: string]: RecordMetadataValue;
}

export interface ChatMetadata extends BaseMetadata {
  conversationId: string;
  agentId: string;
  content: string;
  role: "assistant" | "user";
  topics: string;
  style: string;
  sentiment: string;
  type: string;
}

export interface LocationMetadata extends BaseMetadata {
  lat: number;
  lng: number;
}

export interface CulturalHotspotMetadata extends BaseMetadata {
  name: string;
  location_lat: number;
  location_lng: number;
  visitorCount: number;
  culturalSignificance: number;
  eventFrequency: string;
  nearbyAttractions: string;
  type: string;
  subtype: string;
}

export interface AISystemMetadata extends BaseMetadata {
  agent_id: string;
  decision_text: string;
  pattern_text: string;
  confidence: string;
  protocol_name: string;
  system_id: string;
  context_data: string;
}

export interface CCTVMetadata extends BaseMetadata {
  camera_id: string;
  location: string;
  activity: string;
  confidence: number;
  detected_objects: string;
  area_type: string;
  alert_level: string;
}

export class VectorStoreService {
  private client: Pinecone;
  private index: any;

  constructor(private togetherService: TogetherService) {
    console.log("🔑 Initializing Pinecone client...");
    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.index = this.client.index<
      | ChatMetadata
      | LocationMetadata
      | CulturalHotspotMetadata
      | AISystemMetadata
      | CCTVMetadata
    >("aicity");
  }

  async query({
    vector,
    filter,
    topK = 5,
    includeMetadata = true,
  }: {
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
    topK?: number;
    includeMetadata?: boolean;
  }) {
    try {
      const response = await this.index.query({
        vector,
        filter,
        topK,
        includeValues: false,
        includeMetadata,
      });

      console.log("Raw Pinecone response:", JSON.stringify(response, null, 2));

      if (!response || typeof response !== "object") {
        console.warn("Invalid response from Pinecone");
        return { matches: [] };
      }

      return {
        matches: response.matches || [],
        usage: response.usage,
      };
    } catch (error) {
      console.error("Pinecone query failed:", error);
      throw error;
    }
  }

  async upsert({
    id,
    values,
    metadata,
  }: {
    id: string;
    values: number[];
    metadata: Partial<
      | ChatMetadata
      | LocationMetadata
      | CulturalHotspotMetadata
      | AISystemMetadata
      | CCTVMetadata
    >;
  }) {
    try {
      // Ensure timestamp is a number
      if (metadata.timestamp && typeof metadata.timestamp === "string") {
        metadata.timestamp = parseInt(metadata.timestamp);
      }

      // Convert any nested objects or arrays to strings
      const flatMetadata = Object.entries(metadata).reduce(
        (acc, [key, value]) => {
          if (value === undefined || value === null) {
            return acc;
          }
          if (Array.isArray(value)) {
            acc[key] = value.join(",");
          } else if (typeof value === "object") {
            acc[key] = JSON.stringify(value);
          } else {
            acc[key] = value.toString();
          }
          return acc;
        },
        {} as Record<string, string | number>
      );

      await this.index.upsert([
        {
          id,
          values,
          metadata: flatMetadata,
        },
      ]);
      return { success: true, id };
    } catch (error) {
      console.error("Upsert failed:", error);
      throw error;
    }
  }

  async upsertMany(data: {
    vectors: Array<{
      id: string;
      values: number[];
      metadata: Partial<
        | ChatMetadata
        | LocationMetadata
        | CulturalHotspotMetadata
        | AISystemMetadata
        | CCTVMetadata
      >;
    }>;
    namespace?: string;
  }) {
    try {
      // Process each vector's metadata
      const processedVectors = data.vectors.map((vector) => {
        const flatMetadata = Object.entries(vector.metadata).reduce(
          (acc, [key, value]) => {
            if (value === undefined || value === null) {
              return acc;
            }
            if (Array.isArray(value)) {
              acc[key] = value.join(",");
            } else if (typeof value === "object") {
              acc[key] = JSON.stringify(value);
            } else {
              acc[key] = value.toString();
            }
            return acc;
          },
          {} as Record<string, string | number>
        );

        return {
          ...vector,
          metadata: flatMetadata,
        };
      });

      await this.index.upsert(processedVectors, data.namespace);
      return { ...data, vectors: processedVectors };
    } catch (error) {
      console.error("Pinecone upsert failed:", error);
      throw error;
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    return this.togetherService.createEmbedding(text);
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.describeIndex("aicity");
      return true;
    } catch (error) {
      console.error("Pinecone ping failed:", error);
      return false;
    }
  }

  async close(): Promise<void> {
    console.log("🔑 Closing Pinecone client...");
  }

  async analyzeSentiment(content: string): Promise<number> {
    try {
      const prompt = `Analyze the sentiment and significance of this interaction. Rate it from 0 to 1 where 1 is extremely significant/emotional and 0 is mundane/neutral. Only respond with the number.
      
      Content: "${content}"
      
      Rating:`;

      const sentimentAnalyzer = {
        id: "sentiment-analyzer",
        name: "Sentiment Analyzer",
        personality: "analytical",
        systemPrompt:
          "You are a sentiment analyzer that only responds with a number between 0 and 1.",
        interests: ["sentiment analysis"],
        preferredStyle: "professional" as ConversationStyle,
        traits: {
          curiosity: 0.5,
          enthusiasm: 0.5,
          formality: 1,
          empathy: 0.8,
          analyticalThinking: 1,
          creativity: 0.3,
        },
        contextualResponses: {
          rain: ["Analyzing sentiment in rainy conditions."],
          sunny: ["Analyzing sentiment in sunny conditions."],
        },
        memoryWindowSize: 1,
        emotionalRange: {
          min: 0,
          max: 1,
        },
      };

      const message: Message = {
        id: crypto.randomUUID(),
        agentId: "user",
        content: prompt,
        timestamp: Date.now(),
        role: "user",
        topics: [],
        sentiment: undefined,
      };

      const response = await this.togetherService.generateResponse(
        sentimentAnalyzer,
        [message],
        "You are a sentiment analyzer that only responds with a number between 0 and 1."
      );

      const significance = parseFloat(response.trim());
      return isNaN(significance) ? 0.5 : Math.max(0, Math.min(1, significance));
    } catch (error) {
      console.error("Failed to analyze sentiment:", error);
      return 0.5;
    }
  }
}
