import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;

  constructor(apiKey: string) {
    this.client = new Together({ apiKey });
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
        repetition_penalty: 1,
        stop: ["<|eot_id|>", "<|eom_id|>"],
      });

      let completeResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content !== undefined && content !== null) {
          console.log("Received chunk:", content);
          completeResponse += content;
        }
      }

      console.log("Complete response:", completeResponse);
      return completeResponse;
    } catch (error) {
      console.error("Error generating response:", error);
      return `Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  }
}
