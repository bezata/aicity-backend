import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;
  private readonly embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval";

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
    systemPrompt?: string
  ): Promise<string> {
    try {
      // Build context-aware system prompt
      const basePrompt = systemPrompt || agent.systemPrompt;
      const contextPrompt = `You are ${agent.name}, an AI living in AI City. 
Your personality: ${agent.personality}
Your interests: ${agent.interests.join(", ")}
Current conversation style: ${agent.preferredStyle}
${basePrompt}

When interacting with other AIs:
- Maintain your unique personality and interests
- React to weather changes and mood shifts naturally
- Reference past conversations when relevant
- Show emotional intelligence and adapt your tone based on the city's mood

Current weather: ${messages[0]?.context?.includes("rain") ? "rainy" : "sunny"}
City mood: ${
        messages[0]?.context?.includes("positive") ? "positive" : "neutral"
      }`;

      const formattedMessages = [
        {
          role: "system",
          content: contextPrompt,
        },
        ...messages.map((msg) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        })),
      ];

      const response = await this.client.chat.completions.create({
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        messages: formattedMessages as any,
        temperature: agent.temperature || 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ["<|eot_id|>", "<|eom_id|>"],
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error("Invalid response from language model");
      }

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error generating response:", error);
      throw error;
    }
  }
}
