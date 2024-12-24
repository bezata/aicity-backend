import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

export class TogetherService {
  private client: Together;
  private readonly embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval";
  private lastRequestTime: number = 0;

  constructor(apiKey: string) {
    console.log("🔑 Initializing Together service...");
    if (!apiKey) {
      throw new Error("Together API key is required");
    }
    console.log("API Key length:", apiKey.length);
    console.log(
      "API Key prefix:",
      apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
    );

    this.client = new Together({ apiKey });
    console.log("✅ Together client initialized successfully");
    console.log("⏳ Rate limiting set to 15 seconds between requests");
  }

  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    this.lastRequestTime = Date.now();
    console.log("✅ Rate limit wait complete");
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
    let attempt = 1;

    while (true) {
      try {
        console.log("\n=== Together API Request ===");
        console.log("🤖 Agent:", agent.name);
        console.log("🎭 Role:", agent.role);
        console.log("💬 Messages:", messages.length);
        console.log("🔄 Attempt:", attempt);

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

        console.log("\n📝 API Request:");
        console.log("Model:", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo");
        console.log("System prompt:", systemPrompt || agent.systemPrompt);
        console.log("Temperature:", agent.temperature || 0.7);
        console.log("Messages:", JSON.stringify(formattedMessages, null, 2));

        const response = await this.client.chat.completions.create({
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          messages: formattedMessages,
          temperature: agent.temperature || 0.7,
          max_tokens: 2000,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.2,
        });

        console.log("\n📥 API Response:");
        console.log("Response ID:", response.id);
        console.log("Tokens used:", response.usage);
        console.log("Finish reason:", response.choices[0]?.finish_reason);
        console.log("Raw content:", response.choices[0]?.message?.content);

        if (!response?.choices?.[0]?.message?.content?.trim()) {
          console.error("❌ Empty response content, retrying...");
          attempt++;
          const waitTime = 1000 * Math.pow(2, Math.min(attempt, 10)); // Cap exponential backoff at 1024 seconds
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        const result = response.choices[0].message.content.trim();
        console.log("\n✅ Final response:", result);
        console.log("=========================\n");
        return result;
      } catch (error: any) {
        console.error(`\n❌ Attempt ${attempt} failed:`, error);
        if (error instanceof Error) {
          console.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
        }
        attempt++;
        const waitTime = 1000 * Math.pow(2, Math.min(attempt, 10)); // Cap exponential backoff at 1024 seconds
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  async generateText(prompt: string): Promise<string> {
    let attempt = 1;
    const timeout = 30000; // 30 seconds timeout

    while (true) {
      try {
        console.log("\n=== Together API Text Generation ===");
        console.log("📝 Prompt:", prompt);
        console.log("🔄 Attempt:", attempt);

        await this.waitForRateLimit();

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), timeout);
        });

        // Create the API request promise
        const requestPromise = this.client.chat.completions.create({
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
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

        // If we get here, the request completed before timeout
        console.log("\n📥 API Response:");
        console.log("Response ID:", response.id);
        console.log("Tokens used:", response.usage);
        console.log("Finish reason:", response.choices[0]?.finish_reason);
        console.log("Raw content:", response.choices[0]?.message?.content);

        // Wait a bit longer for incomplete responses
        if (response.choices[0]?.finish_reason === "length") {
          console.log("⚠️ Response may be incomplete, waiting longer...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          attempt++;
          continue;
        }

        if (!response?.choices?.[0]?.message?.content?.trim()) {
          console.log("❌ Empty response content, retrying...");
          attempt++;
          const waitTime = 1000 * Math.pow(2, Math.min(attempt, 10));
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
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

        console.log("✅ Generated text:", result);
        return result;
      } catch (error: any) {
        console.error(`\n❌ Attempt ${attempt} failed:`, error);

        if (error?.message === "Request timeout") {
          console.log("⏳ Request timed out, waiting before retry...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          const waitTime = 2000 * attempt; // Linear backoff
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        attempt++;
      }
    }
  }
}
