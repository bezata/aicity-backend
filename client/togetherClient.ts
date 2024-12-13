import { agents } from "../src/config/agents";
import { Message } from "../src/types/conversation.types";
import { Agent } from "../src/types/agent.types";

export class TogetherClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = "https://api.together.xyz/v1";
    this.apiKey = apiKey;
  }

  static formatMessages(messages: Message[], agent: Agent): string {
    const formattedMessages = messages
      .map(
        (msg) =>
          `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`
      )
      .join("\n");

    return `${agent.systemPrompt}\n\nHuman: ${formattedMessages}\nAssistant:`;
  }

  async generateChatCompletion(messages: Message[], agent: Agent) {
    const prompt = TogetherClient.formatMessages(messages, agent);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [{ role: "user", content: prompt }],
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response;
  }
}
