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
    try {
      // Ensure text is not empty and has valid content
      if (!text || text.trim().length === 0) {
        // Return a default embedding vector if input is empty
        return new Array(768).fill(0); // Using standard embedding size
      }

      const response = await this.togetherService.createEmbedding(text.trim());
      if (!response || !Array.isArray(response)) {
        console.warn("Invalid embedding response, using default vector");
        return new Array(768).fill(0);
      }

      return response;
    } catch (error) {
      console.error("Error creating embedding:", error);
      // Return a default embedding vector on error
      return new Array(768).fill(0);
    }
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
      // Simple rule-based sentiment analysis
      const positiveWords =
        /good|great|excellent|happy|positive|agree|thanks|appreciate|helpful|wonderful|excited|love/gi;
      const negativeWords =
        /bad|poor|terrible|sad|negative|disagree|unfortunately|sorry|problem|issue|concerned|worried/gi;
      const neutralWords = /okay|fine|normal|usual|typical|standard|regular/gi;

      const positiveCount = (content.match(positiveWords) || []).length;
      const negativeCount = (content.match(negativeWords) || []).length;
      const neutralCount = (content.match(neutralWords) || []).length;

      const total = positiveCount + negativeCount + neutralCount || 1;
      const baseScore =
        (positiveCount - negativeCount + neutralCount * 0.5) / total;

      // Normalize to 0-1 range
      return Math.max(0, Math.min(1, (baseScore + 1) / 2));
    } catch (error) {
      console.error("Error in sentiment analysis:", error);
      return 0.5; // Default neutral sentiment
    }
  }
}
