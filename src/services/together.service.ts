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
    const maxAttempts = 5;
    const maxWaitTime = 30000;
    const globalStartTime = Date.now();

    while (attempt <= maxAttempts) {
      try {
        console.log("\n=== Together API Request ===");
        console.log("🤖 Agent:", agent.name);
        console.log("🎭 Role:", agent.role);
        console.log("💬 Messages:", messages.length);
        console.log("🔄 Attempt:", attempt);
        console.log("🎯 Max Attempts:", maxAttempts);
        console.log("⏱️ Max Wait Time:", maxWaitTime);

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

        console.log("\n📝 API Request Details:");
        console.log("Model:", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo");
        console.log("System prompt:", systemPrompt || agent.systemPrompt);
        console.log("Temperature:", agent.temperature || 0.7);
        console.log("Max Tokens:", 2000);
        console.log("Top P:", 0.9);
        console.log("Frequency Penalty:", 0.3);
        console.log("Presence Penalty:", 0.2);
        console.log("Stream:", false);
        console.log("\nFormatted Messages:");
        console.log(JSON.stringify(formattedMessages, null, 2));

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), maxWaitTime);
        });

        console.log("\n🚀 Sending API request...");
        const requestStartTime = Date.now();

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

        // Race between timeout and request
        console.log("⏳ Waiting for response...");
        const response = (await Promise.race([
          requestPromise,
          timeoutPromise,
        ])) as any;

        // Add immediate response validation
        if (!response || typeof response !== "object") {
          throw new Error("Invalid response structure from API");
        }

        const requestEndTime = Date.now();
        console.log(`⏱️ Response time: ${requestEndTime - requestStartTime}ms`);

        // Log the entire response for debugging
        console.log(
          "\n📥 Raw API Response:",
          JSON.stringify(response, null, 2)
        );

        console.log("\n📥 API Response Details:");
        console.log("Response ID:", response?.id || "No ID");
        console.log("Response Object Keys:", Object.keys(response || {}));
        console.log("Choices Array Length:", response?.choices?.length || 0);
        console.log(
          "First Choice Object Keys:",
          Object.keys(response?.choices?.[0] || {})
        );
        console.log(
          "Message Object Keys:",
          Object.keys(response?.choices?.[0]?.message || {})
        );
        console.log("Tokens Used:", response?.usage || "No usage data");
        console.log(
          "Finish Reason:",
          response?.choices?.[0]?.finish_reason || "No finish reason"
        );
        console.log(
          "Raw Content Type:",
          typeof response?.choices?.[0]?.message?.content
        );
        console.log(
          "Raw Content Length:",
          response?.choices?.[0]?.message?.content?.length || 0
        );
        console.log(
          "Raw Content:",
          response?.choices?.[0]?.message?.content || "NO CONTENT"
        );

        // Validate response content
        if (!response?.choices?.[0]?.message?.content?.trim()) {
          console.error("\n❌ Empty Response Analysis:");
          console.error(
            "Response Structure:",
            JSON.stringify(response, null, 2)
          );
          console.error("Is Response Null?", response === null);
          console.error("Is Choices Array Empty?", !response?.choices?.length);
          console.error("Is Message Null?", !response?.choices?.[0]?.message);
          console.error(
            "Is Content Empty?",
            !response?.choices?.[0]?.message?.content
          );
          console.error(
            "Is Content Only Whitespace?",
            response?.choices?.[0]?.message?.content?.trim() === ""
          );
          throw new Error("Empty response from API");
        }

        const result = response.choices[0].message.content.trim();
        console.log("\n✅ Final Response Analysis:");
        console.log("Response Length:", result.length);
        console.log("First 100 chars:", result.substring(0, 100));
        console.log(
          "Contains Special Chars:",
          /[^a-zA-Z0-9\s.,!?]/.test(result)
        );
        console.log("Word Count:", result.split(/\s+/).length);
        console.log("\nFull Response:", result);
        console.log("=========================\n");
        return result;
      } catch (error: any) {
        console.error(`\n❌ Attempt ${attempt} Error Analysis:`);
        console.error("Error Type:", error.constructor.name);
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        console.error("Is Timeout Error?", error.message === "Request timeout");
        console.error("Is Network Error?", error.message.includes("network"));
        console.error("Is API Error?", error.message.includes("API"));

        if (attempt === maxAttempts) {
          console.error("\n🔴 All Attempts Failed Analysis:");
          console.error("Total Attempts Made:", attempt);
          console.error(
            "Total Time Spent:",
            Date.now() - globalStartTime,
            "ms"
          );
          console.error("Using Default Response");
          return this.generateDefaultResponse(agent, messages);
        }

        attempt++;
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`\n⏳ Retry Analysis:`);
        console.log("Current Attempt:", attempt);
        console.log("Wait Time:", waitTime, "ms");
        console.log(
          "Next Attempt At:",
          new Date(Date.now() + waitTime).toISOString()
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return this.generateDefaultResponse(agent, messages);
  }

  private generateDefaultResponse(agent: Agent, messages: Message[]): string {
    const defaultResponses = [
      `As ${agent.name}, I acknowledge what's been said and would like to contribute thoughtfully to our discussion.`,
      `From my perspective as ${agent.role}, I find this conversation engaging and would like to share my thoughts.`,
      `Given my background as ${agent.role}, I have some relevant insights to share with the group.`,
      `I appreciate the points being made, and as ${agent.name}, I'd like to add to this discussion.`,
      `Based on my experience as ${agent.role}, I can offer a unique perspective on this topic.`,
    ];

    return defaultResponses[
      Math.floor(Math.random() * defaultResponses.length)
    ];
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
        console.log("Request Promise:", requestPromise);
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
