// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import { RecordMetadata } from "@pinecone-database/pinecone";

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

  constructor() {
    console.log("🔑 Initializing Pinecone client...");
    this.client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    // Get index reference
    this.index = this.client.index<ChatMetadata & RecordMetadata>("aicity");
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

  async upsert({
    id,
    values,
    metadata,
  }: {
    id: string;
    values: number[];
    metadata: Partial<ChatMetadata>;
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

  async query({
    vector,
    topK = 5,
    filter = {},
  }: {
    vector: number[];
    topK?: number;
    filter?: any;
  }) {
    try {
      const results = await this.index.query({
        vector,
        topK,
        filter,
        includeMetadata: true,
      });
      return {
        matches: results.matches.map((match: any) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata,
        })),
      };
    } catch (error) {
      console.error("Query failed:", error);
      throw error;
    }
  }

  async close() {
    // Pinecone client doesn't need explicit cleanup
  }
}
