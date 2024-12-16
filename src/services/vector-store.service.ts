// src/services/vector-store.service.ts
import { MongoClient, Collection, ObjectId } from "mongodb";
import type { Message } from "../types/conversation.types";

// Define metadata type for better type safety
interface ChatMetadata {
  _id?: ObjectId;
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
  embedding?: number[];
}

export class VectorStoreService {
  private client: MongoClient;
  private collection!: Collection<ChatMetadata>;
  private readonly dbName = "ai_city";
  private readonly collectionName = "chat_memory";
  private initialized = false;

  constructor(mongoUri: string) {
    this.client = new MongoClient(mongoUri);
    this.initializeDB();
  }

  private async initializeDB() {
    try {
      await this.client.connect();
      const db = this.client.db(this.dbName);
      this.collection = db.collection<ChatMetadata>(this.collectionName);

      // Create vector search index if it doesn't exist
      const indexes = await this.collection.listIndexes().toArray();
      const hasVectorIndex = indexes.some(
        (index) => index.name === "vector_index"
      );

      if (!hasVectorIndex) {
        await db.command({
          createIndexes: this.collectionName,
          indexes: [
            {
              name: "vector_index",
              key: { embedding: "vector" },
              vectorOptions: {
                dimension: 768,
                similarity: "cosine",
              },
            },
          ],
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error("Error initializing MongoDB:", error);
      throw new Error(
        `Failed to initialize MongoDB: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
      if (!this.initialized) await this.initializeDB();

      await this.collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...metadata,
            embedding: values,
            indexed_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("Error upserting document:", error);
      throw new Error(
        `Failed to upsert document: ${
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
      if (!this.initialized) await this.initializeDB();

      const pipeline = [
        {
          $vectorSearch: {
            queryVector: vector,
            path: "embedding",
            numCandidates: topK * 10,
            limit: topK,
            index: "vector_index",
          },
        },
        {
          $match: filter,
        },
      ];

      const results = await this.collection.aggregate(pipeline).toArray();
      return {
        matches: results.map((doc) => ({
          id: doc._id,
          score: doc.score,
          metadata: {
            conversationId: doc.conversationId,
            content: doc.content,
            timestamp: doc.timestamp,
            agentId: doc.agentId,
            role: doc.role,
            style: doc.style,
            topics: doc.topics,
            sentiment: doc.sentiment,
          },
        })),
      };
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
      if (!this.initialized) await this.initializeDB();

      const message = await this.collection.findOne({
        _id: new ObjectId(messageId),
      });

      if (!message?.embedding) return null;

      return this.query({
        vector: message.embedding,
        topK: 5,
        filter: { conversationId },
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
      if (!this.initialized) await this.initializeDB();

      await this.collection.deleteMany({ conversationId });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw new Error(
        `Failed to delete conversation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}
