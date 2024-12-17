// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import { RecordMetadata } from "@pinecone-database/pinecone";
import { TogetherService } from "./together.service";
import { QueryRequest } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch/db_data/models/QueryRequest";


interface ChatMetadata {
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
}

export class VectorStoreService {
  private client: Pinecone;
  private index: any;
  private store: Map<
    string,
    {
      id: string;
      values: number[];
      metadata: Partial<ChatMetadata>;
    }
  > = new Map();

  constructor(private togetherService: TogetherService) {
    console.log("🔑 Initializing Pinecone client...");
    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    // Get index reference
    this.index = this.client.index<ChatMetadata & RecordMetadata>("aicity");
  }
  async query(query: QueryRequest): Promise<QueryResult> {
    return this.index.query(query);
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

  async createEmbedding(text: string): Promise<number[]> {
    return this.togetherService.createEmbedding(text);
  }

  async upsert(data: {
    id: string;
    values: number[];
    metadata: Partial<ChatMetadata>;
  }) {
    this.store.set(data.id, data);
    return data;
  }

  async search(values: number[], limit = 5) {
    // Implementation of vector similarity search
    return Array.from(this.store.values())
      .slice(0, limit)
      .map((item) => ({
        ...item,
        score: 1.0, // Placeholder for actual similarity score
      }));
  }

  async close() {
    // Pinecone client doesn't need explicit cleanup
  }
}
