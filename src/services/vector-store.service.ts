// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import type { Message } from "../types/conversation.types";
import Together from "together-ai";

// Define metadata interface that extends RecordMetadata
interface MessageMetadata {
  agentId: string;
  content: string;
  timestamp: number;
  context?: string;
  topics?: string[];
  type?: string;
  indexed_at?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export class VectorStoreService {
  private pinecone: Pinecone;
  private index: any;

  constructor(apiKey: string) {
    this.pinecone = new Pinecone({
      apiKey,
    });
    this.initializeIndex();
  }

  private async initializeIndex() {
    const indexName = "conversations";

    try {
      // Try to get the index first
      this.index = this.pinecone.index(indexName);

      // Verify the index exists by listing indexes
      const indexList = await this.pinecone.listIndexes();
      if (!indexList?.indexes?.some((index) => index.name === indexName)) {
        throw { status: 404 };
      }
    } catch (error: any) {
      // Only create if the index doesn't exist
      if (error.status === (404 as unknown)) {
        await this.pinecone.createIndex({
          name: indexName,
          dimension: 1024,
          metric: "cosine",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1",
            },
          },
        });
        this.index = this.pinecone.index(indexName);
      } else {
        throw error;
      }
    }
  }

  async storeMessage(message: Message) {
    const embedding = await this.getEmbedding(message.content);

    const record = {
      id: message.id,
      values: embedding,
      metadata: {
        agentId: message.agentId,
        content: message.content,
        timestamp: message.timestamp,
        context: message.context,
        topics: message.topics,
        type: "message",
        indexed_at: new Date().toISOString(),
      } satisfies MessageMetadata,
    };

    await this.index.upsert([record]);
  }

  async queryRelevantMemories(
    query: string,
    agentId: string,
    limit: number = 5
  ) {
    const queryEmbedding = await this.getEmbedding(query);

    const results = await this.index.query({
      vector: queryEmbedding,
      filter: { agentId },
      topK: limit,
      includeMetadata: true,
    });

    return results.matches.map(
      (match: { metadata: MessageMetadata }) => match.metadata
    );
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const together = new Together({ apiKey: process.env.TOGETHER_API_KEY! });

    const response = await together.embeddings.create({
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      input: text,
    });

    return response.data[0].embedding;
  }

  // Helper method to delete index if needed
  async deleteIndex() {
    await this.pinecone.deleteIndex("conversations");
  }
}
