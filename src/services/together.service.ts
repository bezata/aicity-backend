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
    const maxWaitTime = 30000;

    while (true) {
      try {
        await this.waitForRateLimit();

        type ApiMessage = {
          role: "system" | "user" | "assistant";
          content: string;
        };

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

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), maxWaitTime);
        });

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

        if (!response || typeof response !== "object") {
          throw new Error("Invalid response structure from API");
        }
        if (!response?.choices?.[0]?.message?.content?.trim()) {
          throw new Error("Empty response from API");
        }

        return response.choices[0].message.content.trim();
      } catch (error: any) {
        console.error(`\n❌ Attempt ${attempt} failed:`, error.message);
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        attempt++;
      }
    }
  }

  async generateText(prompt: string): Promise<string> {
    let attempt = 1;
    const timeout = 120000; // 120 seconds timeout

    while (true) {
      try {
        await this.waitForRateLimit();
        console.log(`\n🔄 Attempt ${attempt} to generate text...`);

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

        // If response is incomplete, retry
        if (response.choices[0]?.finish_reason === "length") {
          console.log("⚠️ Incomplete response, retrying...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          attempt++;
          continue;
        }

        // If response is empty, retry
        if (!response?.choices?.[0]?.message?.content?.trim()) {
          console.log("⚠️ Empty response, retrying...");
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000); // Cap at 30 seconds
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          attempt++;
          continue;
        }

        const result = response.choices[0].message.content.trim();

        // Validate JSON if the prompt asks for JSON
        if (prompt.toLowerCase().includes("json")) {
          try {
            JSON.parse(result);
          } catch (e) {
            console.log("⚠️ Invalid JSON response, retrying...");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            attempt++;
            continue;
          }
        }

        console.log(`✅ Success on attempt ${attempt}`);
        return result;
      } catch (error: any) {
        console.error(`\n❌ Attempt ${attempt} failed:`, error.message);

        if (error?.message === "Request timeout") {
          console.log("⏳ Request timed out, retrying after 5 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          const waitTime = Math.min(2000 * attempt, 30000); // Cap at 30 seconds
          console.log(`⏳ Waiting ${waitTime / 1000} seconds before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        attempt++;
      }
    }
  }
}
