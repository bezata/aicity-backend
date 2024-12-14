// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import type { Message } from "../types/conversation.types";

interface MessageMetadata {
  agentId: string;
  content: string;
  timestamp: number;
  conversationId: string;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
  indexed_at: string;
}

export class VectorStoreService {
  private pinecone: Pinecone;
  private index: any;
  private readonly indexName = "conversations";
  private readonly namespace = "chat-memory";

  constructor(apiKey: string) {
    this.pinecone = new Pinecone({
      apiKey,
    });
    this.initializeIndex();
  }

  private async initializeIndex() {
    try {
      this.index = this.pinecone.index(this.indexName);

      // Verify index exists
      const indexes = await this.pinecone.listIndexes();
      if (!indexes?.indexes?.some((index) => index.name === this.indexName)) {
        await this.createIndex();
      }
    } catch (error) {
      console.error("Error initializing index:", error);
      await this.createIndex();
    }
  }

  private async createIndex() {
    await this.pinecone.createIndex({
      name: this.indexName,
      dimension: 1024,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-west1",
        },
      },
    });
    this.index = this.pinecone.index(this.indexName);
  }

  async upsert({
    id,
    values,
    metadata,
  }: {
    id: string;
    values: number[];
    metadata: Partial<MessageMetadata>;
  }) {
    try {
      await this.index.upsert({
        vectors: [
          {
            id,
            values,
            metadata: {
              ...metadata,
              indexed_at: new Date().toISOString(),
            },
          },
        ],
        namespace: this.namespace,
      });
    } catch (error) {
      console.error("Error upserting vector:", error);
      throw new Error(
        `Failed to upsert vector: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async query({
    vector,
    topK = 5,
    filter = {},
  }: {
    vector: number[];
    topK?: number;
    filter?: Record<string, any>;
  }) {
    try {
      return await this.index.query({
        vector,
        topK,
        filter,
        namespace: this.namespace,
        includeMetadata: true,
      });
    } catch (error) {
      console.error("Error querying vectors:", error);
      throw new Error(
        `Failed to query vectors: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async deleteConversation(conversationId: string) {
    try {
      await this.index.deleteMany({
        filter: { conversationId },
        namespace: this.namespace,
      });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw new Error(
        `Failed to delete conversation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async deleteIndex() {
    try {
      await this.pinecone.deleteIndex(this.indexName);
    } catch (error) {
      console.error("Error deleting index:", error);
      throw new Error(
        `Failed to delete index: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
