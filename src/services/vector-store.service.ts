// src/services/vector-store.service.ts
import { Pinecone } from "@pinecone-database/pinecone";
import type { Message } from "../types/conversation.types";
import type { RecordMetadata } from "@pinecone-database/pinecone";

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

    // Check if index exists
    const indexes = await this.pinecone.listIndexes();
    const indexExists = Object.values(indexes).some((index: { name: string }) => index.name === indexName);

    if (!indexExists) {
      // Create index if it doesn't exist
      await this.pinecone.createIndex({
        name: indexName,
        dimension: 1024, // Dimension for m2-bert-80M-8k-base
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
    }

    this.index = this.pinecone.index(indexName);
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
        // Add any additional metadata fields here
        type: "message", // Example of additional metadata
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

    return results.matches.map((match: { metadata: MessageMetadata }) => match.metadata);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch("https://api.together.xyz/api/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "togethercomputer/m2-bert-80M-8k-base",
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get embedding: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  // Helper method to delete index if needed
  async deleteIndex() {
    await this.pinecone.deleteIndex("conversations");
  }
}
