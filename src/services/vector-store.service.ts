// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import { RecordMetadata } from "@pinecone-database/pinecone";
import { TogetherService } from "./together.service";

interface ChatMetadata {
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
  type?: "conversation" | "collaboration" | "district" | "transport";
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
        namespace,
      });
    } catch (error) {
      console.error("Pinecone query failed:", error);
      throw error;
    }
  }

  async upsert(data: {
    id: string;
    values: number[];
    metadata: Partial<ChatMetadata & RecordMetadata & { type: string }>;
    namespace?: string;
  }) {
    try {
      await this.index.upsert({
        vectors: [
          {
            id: data.id,
            values: data.values,
            metadata: data.metadata,
          },
        ],
        namespace: data.namespace,
      });
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
}
