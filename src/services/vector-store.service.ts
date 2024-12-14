// src/services/vector-store.service.ts
import {
  Pinecone,
  RecordMetadata,
  RecordMetadataValue,
} from "@pinecone-database/pinecone";
import type { Message } from "../types/conversation.types";

// Define metadata type for better type safety
interface ChatMetadata {
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
  indexed_at?: string;
  [key: string]: RecordMetadataValue | RecordMetadataValue[] | null | undefined;
}

export class VectorStoreService {
  private pinecone: Pinecone;
  private index: any;
  private readonly indexName = "chat-memory";
  private readonly namespace = "conversations";

  constructor(apiKey: string) {
    this.pinecone = new Pinecone({
      apiKey,
    });
    this.initializeIndex();
  }

  private async initializeIndex() {
    try {
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(
        (idx) => idx.name === this.indexName
      );

      if (indexExists) {
        // If index exists, just get it
        this.index = await this.pinecone.index<RecordMetadata>(this.indexName);
      } else {
        // Create new index only if it doesn't exist
        await this.createIndex();
      }
    } catch (error) {
      console.error("Error initializing index:", error);
      if (error instanceof Error && !error.message.includes("ALREADY_EXISTS")) {
        throw error;
      }
      // If index already exists, just get it
      this.index = await this.pinecone.index<RecordMetadata>(this.indexName);
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
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
    this.index = await this.pinecone.index<RecordMetadata>(this.indexName);
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
      const namespace = this.index.namespace(this.namespace);
      await namespace.upsert([
        {
          id,
          values,
          metadata: {
            ...metadata,
            indexed_at: new Date().toISOString(),
          },
        },
      ]);
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
      const namespace = this.index.namespace(this.namespace);
      return await namespace.query({
        vector,
        topK,
        filter,
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

  async getConversationContext(conversationId: string, messageId: string) {
    try {
      const namespace = this.index.namespace(this.namespace);
      const result = await namespace.fetch([messageId]);
      if (!result.records[messageId]) {
        return null;
      }

      return await namespace.query({
        vector: result.records[messageId].values,
        topK: 5,
        filter: { conversationId },
        includeMetadata: true,
      });
    } catch (error) {
      console.error("Error getting conversation context:", error);
      throw new Error(
        `Failed to get conversation context: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async deleteConversation(conversationId: string) {
    try {
      const namespace = this.index.namespace(this.namespace);
      await namespace.deleteMany({
        filter: { conversationId },
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
}
