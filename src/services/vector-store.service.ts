// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import { RecordMetadata } from "@pinecone-database/pinecone";
import { TogetherService } from "./together.service";
import { VectorStoreType } from "../types/vector-store.types";
import type { ConversationStyle } from "../types/common.types";
import type { Message } from "../types/conversation.types";

export interface ChatMetadata {
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
  type?: VectorStoreType;
}

export class VectorStoreService {
  private client: Pinecone;
  private index: any;

  constructor(private togetherService: TogetherService) {
    console.log("🔑 Initializing Pinecone client...");
    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.index = this.client.index<ChatMetadata & RecordMetadata>("aicity");
  }

  async query({
    vector,
    filter,
    topK = 5,
    includeMetadata = true,
    namespace = "",
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
    namespace?: string;
  }) {
    try {
      return await this.index.query({
        vector,
        filter,
        topK,
        includeMetadata,
      });
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
    metadata: Partial<ChatMetadata & RecordMetadata & { type: string }>;
  }) {
    try {
      await this.index.upsert([
        {
          id,
          values,
          metadata,
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
      metadata: Partial<ChatMetadata & RecordMetadata & { type: string }>;
    }>;
    namespace?: string;
  }) {
    try {
      await this.index.upsert(data.vectors, data.namespace);
      return data;
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
      // Use the TogetherService to analyze the sentiment
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
        memoryWindowSize: 1, // Only need current message
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

      // Extract the number from the response
      const significance = parseFloat(response.trim());
      return isNaN(significance) ? 0.5 : Math.max(0, Math.min(1, significance));
    } catch (error) {
      console.error("Failed to analyze sentiment:", error);
      return 0.5; // Default to neutral if analysis fails
    }
  }
}
