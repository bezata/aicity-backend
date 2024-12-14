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
        model: "togethercomputer/m2-bert-80M-8k-base",
        input: text,
      });

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

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content !== undefined && content !== null) {
          completeResponse += content;
        }
      }

      return completeResponse.trim();
    } catch (error) {
      console.error("Error generating response:", error);
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
