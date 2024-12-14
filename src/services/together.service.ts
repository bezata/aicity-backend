import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;

  constructor(apiKey: string) {
    this.client = new Together({ apiKey });
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
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
    conversationHistory: Message[],
    systemPrompt: string
  ) {
    try {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...conversationHistory.map((msg) => ({
          role: msg.role as "assistant" | "user",
          content: msg.content,
        })),
      ];

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 25000); // 25 second timeout

      const stream = await this.client.chat.completions.create({
        messages,
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        stream: true,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1.1,
        max_tokens: 1024,
        stop: ["<|endoftext|>", "<|im_end|>", "<|im_sep|>"],
      });

      let completeResponse = "";
      try {
        for await (const chunk of stream) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content !== undefined && content !== null) {
            completeResponse += content;
          }
        }
      } finally {
        clearTimeout(timeout);
      }

      return (
        completeResponse.trim() ||
        "I apologize, but I couldn't generate a response in time."
      );
    } catch (error) {
      console.error("Error generating response:", error);
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("timeout"))
      ) {
        throw new Error("Request timed out while generating response");
      }
      throw new Error(
        `Failed to generate response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private formatConversationHistory(messages: Message[]): string {
    return messages
      .map(
        (msg) =>
          `${msg.role === "assistant" ? "Assistant" : "User"}: ${msg.content}`
      )
      .join("\n");
  }
}
