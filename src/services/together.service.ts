import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;
  private readonly embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval";

  constructor(apiKey: string) {
    console.log("🔑 Initializing Together service...");
    this.client = new Together({ apiKey });
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log(
        "📝 Creating embedding for text:",
        text.substring(0, 50) + "..."
      );
      const response = await this.client.embeddings.create({
        model: "togethercomputer/m2-bert-80M-8k-retrieval",
        input: text,
      });
      console.log("✅ Embedding created successfully");
      return response.data[0].embedding;
    } catch (error) {
      console.error("❌ Embedding creation failed:", error);
      throw error;
    }
  }

  async generateResponse(
    agent: Agent,
    messages: Message[],
    systemPrompt?: string
  ): Promise<string> {
    try {
      console.log("🤖 Generating response for agent:", agent.name);
      console.log("📜 System prompt:", systemPrompt);
      console.log("💬 Messages count:", messages.length);

      const formattedMessages = [
        {
          role: "system",
          content: systemPrompt || agent.systemPrompt,
        },
        ...messages.map((msg) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        })),
      ];

      console.log("🎯 Calling Together API...");
      const response = await this.client.chat.completions.create({
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        messages: formattedMessages as any,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ["<|eot_id|>", "<|eom_id|>"],
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Invalid response from language model");
      }

      const result = response.choices[0].message.content.trim();
      console.log("✅ Response generated:", result.substring(0, 50) + "...");
      return result;
    } catch (error) {
      console.error("❌ Response generation failed:", error);
      throw error;
    }
  }
}
