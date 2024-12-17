import { Message } from "../src/types/conversation.types";
import { Agent } from "../src/types/agent.types";
import Together from "together-ai";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class TogetherClient {
  private client: Together;

  constructor(apiKey: string) {
    this.client = new Together({ apiKey });
  }

  static formatMessages(messages: Message[], agent: Agent): ChatMessage[] {
    return [
      {
        role: "system" as ChatMessage["role"],
        content: agent.systemPrompt,
      },
      ...messages.map((msg) => ({
        role: (msg.role === "user"
          ? "user"
          : "assistant") as ChatMessage["role"],
        content: msg.content,
      })),
    ];
  }

  async generateChatCompletion(messages: Message[], agent: Agent) {
    try {
      const formattedMessages = TogetherClient.formatMessages(messages, agent);

      const response = await this.client.chat.completions.create({
        messages: formattedMessages,
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ["<|eot_id|>", "<|eom_id|>"],
        stream: true,
      });

      return response;
    } catch (error) {
      console.error("Error in chat completion:", error);
      throw error;
    }
  }

  async *streamResponse(response: AsyncIterable<any>) {
    try {
      for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
          yield chunk.choices[0].delta.content;
        }
      }
    } catch (error) {
      console.error("Error in streaming response:", error);
      throw error;
    }
  }
}
