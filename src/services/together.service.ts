import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;
  private readonly embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval";
  private lastRequestTime: number = 0;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Together API key is required");
    }

    this.client = new Together({ apiKey });
  }

  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    this.lastRequestTime = Date.now();
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "togethercomputer/m2-bert-80M-8k-retrieval",
        input: text,
      });

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
    let attempt = 1;
    const maxAttempts = 5;
    const maxWaitTime = 30000;
    const globalStartTime = Date.now();

    while (attempt <= maxAttempts) {
      try {
        await this.waitForRateLimit();

        type ApiMessage = {
          role: "system" | "user" | "assistant";
          content: string;
        };

        // Format messages for the API
        const formattedMessages: ApiMessage[] = [
          {
            role: "system",
            content: systemPrompt || agent.systemPrompt,
          },
          ...messages.map(
            (msg): ApiMessage => ({
              role: msg.role === "user" ? "user" : "assistant",
              content: msg.content,
            })
          ),
        ];

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), maxWaitTime);
        });

        // Create the API request promise
        const requestPromise = this.client.chat.completions.create({
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          messages: formattedMessages,
          temperature: agent.temperature || 0.8,
          max_tokens: 150,
          top_p: 0.95,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
          stream: false,
          stop: ["</s>", "<s>", "[INST]", "[/INST]"],
        });

        const response = (await Promise.race([
          requestPromise,
          timeoutPromise,
        ])) as any;

        // Add immediate response validation
        if (!response || typeof response !== "object") {
          throw new Error("Invalid response structure from API");
        }
        // Validate response content
        if (!response?.choices?.[0]?.message?.content?.trim()) {
          throw new Error("Empty response from API");
        }

        const result = response.choices[0].message.content.trim();

        return result;
      } catch (error: any) {
        attempt++;
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);

        new Date(Date.now() + waitTime).toISOString();

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  async generateText(prompt: string): Promise<string> {
    let attempt = 1;
    const timeout = 120000; // 120 seconds timeout

    while (true) {
      try {
        await this.waitForRateLimit();

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), timeout);
        });

        // Create the API request promise
        const requestPromise = this.client.chat.completions.create({
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          messages: [
            {
              role: "system" as const,
              content:
                "You are a helpful AI assistant. Provide clear and concise responses. Always complete your responses fully.",
            },
            {
              role: "user" as const,
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.2,
        });

        // Race between timeout and request
        const response = (await Promise.race([
          requestPromise,
          timeoutPromise,
        ])) as any;

        // Wait a bit longer for incomplete responses
        if (response.choices[0]?.finish_reason === "length") {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          attempt++;
          continue;
        }

        if (!response?.choices?.[0]?.message?.content?.trim()) {
          attempt++;
          const waitTime = 1000 * Math.pow(2, Math.min(attempt, 10));

          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        const result = response.choices[0].message.content.trim();

        // Validate JSON if the prompt asks for JSON
        if (prompt.toLowerCase().includes("json")) {
          try {
            JSON.parse(result);
          } catch (e) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            attempt++;
            continue;
          }
        }

        return result;
      } catch (error: any) {
        console.error(`\n❌ Attempt ${attempt} failed:`, error);

        if (error?.message === "Request timeout") {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          const waitTime = 2000 * attempt; // Linear backoff

          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        attempt++;
      }
    }
  }
}
