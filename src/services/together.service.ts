import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;
  private readonly embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval"; // Using m2-bert for better retrieval performance

  constructor(apiKey: string) {
    this.client = new Together({ apiKey });
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      if (!response?.data?.[0]?.embedding) {
        throw new Error("Invalid embedding response");
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw new Error(
        `Failed to create embedding: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async generateResponse(
    agent: Agent,
    messages: Message[],
    systemPrompt: string
  ): Promise<string> {
    try {
      const formattedMessages = messages
        .map(
          (msg) =>
            `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`
        )
        .join("\n");

      const prompt = `${systemPrompt}\n\nConversation History:\n${formattedMessages}\nAssistant:`;

      const response = await this.client.completions.create({
        model: agent.model || "meta-llama/Llama-2-70b-chat",
        prompt,
        temperature: agent.temperature || 0.7,
        max_tokens: agent.maxTokens || 500,
        stop: ["Human:", "Assistant:"],
      });

      if (!response?.choices?.[0]?.text) {
        throw new Error("Invalid response from language model");
      }

      return response.choices[0].text.trim();
    } catch (error) {
      console.error("Error generating response:", error);
      throw new Error(
        `Failed to generate response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
