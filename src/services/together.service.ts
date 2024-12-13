import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;

  constructor(apiKey: string) {
    this.client = new Together({ apiKey });
  }

  async *generateResponse(
    agent: Agent,
    conversationHistory: Message[],
    systemPrompt: string
  ) {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role as "assistant" | "user",
        content: msg.content,
      })),
    ];

    const response = await this.client.chat.completions.create({
      messages,
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.7,
      top_k: 50,
      repetition_penalty: 1,
      stop: ["<|eot_id|>", "<|eom_id|>"],
      stream: true,
    });

    for await (const chunk of response) {
      if (chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  }
}
