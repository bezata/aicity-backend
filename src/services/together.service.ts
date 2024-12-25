import { Together } from "together-ai";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

interface MessageCache {
  content: string;
  timestamp: number;
  attempts: number;
  conversationLength?: number;
}

interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number;
}

export class TogetherService {
  private client: Together;
  private readonly embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval";
  private readonly chatModel = "meta-llama/Llama-3.2-3B-Instruct-Turbo";
  private lastRequestTime: number = 0;
  private messageCache: Map<string, MessageCache> = new Map();
  private readonly cacheDuration = 30000; // 30 seconds cache
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 3000,
    maxDelay: 10000,
  };

  private readonly defaultStopSequences = [
    "</s>",
    "<|im_end|>",
    "<|endoftext|>",
    "\nHuman:",
    "\nAssistant:",
    "\nUser:",
    "Human:",
    "Assistant:",
    "User:",
  ];

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Together API key is required");
    }
    this.client = new Together({ apiKey });
  }

  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minRequestInterval = 2000;

    if (timeSinceLastRequest < minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number, baseDelay: number = 3000): number {
    const exponentialDelay = Math.min(
      this.retryConfig.maxDelay,
      baseDelay * Math.pow(2, attempt)
    );
    return exponentialDelay * (0.75 + Math.random() * 0.5);
  }

  private isDuplicateMessage(conversationId: string, content: string): boolean {
    const key = `${conversationId}:${content}`;
    const cached = this.messageCache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheDuration) {
      cached.attempts++;
      this.messageCache.set(key, cached);
      return true;
    }

    for (const [key, value] of this.messageCache.entries()) {
      if (now - value.timestamp > this.cacheDuration) {
        this.messageCache.delete(key);
      }
    }

    this.messageCache.set(key, {
      content,
      timestamp: now,
      attempts: 1,
      conversationLength: conversationId
        ? this.messageCache.get(`${conversationId}:length`)
            ?.conversationLength || 1
        : 1,
    });
    return false;
  }

  async generateResponse(
    agent: Agent,
    messages: Message[],
    systemPrompt?: string,
    maxHistory: number = 10
  ): Promise<string> {
    const conversationId =
      messages[messages.length - 1]?.metadata?.conversationId;
    const maxRetries = this.retryConfig.maxRetries;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.delay(5000);
        await this.waitForRateLimit();

        const effectiveSystemPrompt = (
          systemPrompt ||
          agent.systemPrompt ||
          "You are an AI assistant living in Neurova City."
        ).trim();

        const recentMessages = messages.slice(-maxHistory);

        const formattedMessages = [
          {
            role: "system" as const,
            content: effectiveSystemPrompt + "\n\nAssistant: ",
          },
          ...recentMessages.map((msg) => ({
            role:
              msg.role === "user" ? ("user" as const) : ("assistant" as const),
            content:
              msg.content.trim() +
              (msg.role === "user" ? "\n\nAssistant: " : "\n\nHuman: "),
          })),
        ];

        console.log("Sending request to Together API:", {
          model: this.chatModel,
          messageCount: formattedMessages.length,
          historyLength: maxHistory,
          systemPrompt: effectiveSystemPrompt.substring(0, 100) + "...",
        });

        const response = await this.client.chat.completions.create({
          model: this.chatModel,
          messages: formattedMessages,
          temperature: Math.min(
            (agent.temperature || 0.7) + 0.05 * attempt,
            0.9
          ),
          max_tokens: 512,
          top_p: 0.95,
          frequency_penalty: Math.min(0.5 + 0.05 * attempt, 0.8),
          presence_penalty: Math.min(0.5 + 0.05 * attempt, 0.8),
          stop: this.defaultStopSequences,
          stream: false,
        });

        const content = response.choices[0]?.message?.content?.trim();

        if (!content || content.length < 2) {
          console.error("Empty or invalid response from API:", response);
          const backoffTime = this.calculateBackoff(attempt);
          await this.delay(backoffTime);
          continue;
        }

        // Clean up any remaining stop sequences from the content
        const cleanedContent = this.cleanStopSequences(content);

        if (
          conversationId &&
          this.isDuplicateMessage(conversationId, cleanedContent)
        ) {
          console.log("Detected duplicate message, retrying...");
          const backoffTime = this.calculateBackoff(attempt);
          await this.delay(backoffTime);
          continue;
        }

        console.log("Successfully generated response:", {
          length: cleanedContent.length,
          preview: cleanedContent.substring(0, 50) + "...",
        });

        return cleanedContent;
      } catch (error: any) {
        console.error(`API error on attempt ${attempt + 1}:`, error);
        if (attempt === maxRetries - 1) {
          throw new Error(`Response generation failed: ${error.message}`);
        }
        const backoffTime = this.calculateBackoff(attempt);
        await this.delay(backoffTime);
      }
    }

    throw new Error("Response generation failed after all retries");
  }

  private cleanStopSequences(content: string): string {
    let cleaned = content;
    for (const stop of this.defaultStopSequences) {
      cleaned = cleaned.split(stop)[0].trim();
    }
    return cleaned;
  }

  async generateText(
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      topK?: number;
      repetitionPenalty?: number;
      stopSequences?: string[];
      model?: string;
    } = {}
  ): Promise<string> {
    const defaultModel = "meta-llama/Llama-3.2-3B-Instruct-Turbo";

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();

        const response = await this.client.completions.create({
          model: options.model || defaultModel,
          prompt: prompt + "\n\nAssistant: ",
          max_tokens: options.maxTokens || 512,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.95,
          top_k: options.topK || 50,
          repetition_penalty: options.repetitionPenalty || 1.1,
          stop: options.stopSequences || this.defaultStopSequences,
          stream: false,
        });

        const generatedText = response.choices[0]?.text?.trim();

        if (!generatedText) {
          const backoffTime = this.calculateBackoff(attempt);
          await this.delay(backoffTime);
          continue;
        }

        return generatedText;
      } catch (error) {
        if (attempt === this.retryConfig.maxRetries - 1) {
          throw new Error("Text generation failed");
        }
        const backoffTime = this.calculateBackoff(attempt);
        await this.delay(backoffTime);
      }
    }

    throw new Error("Text generation failed");
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      console.error("Attempted to create embedding for empty text");
      return new Array(768).fill(0.1);
    }

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();

        const response = await this.client.embeddings.create({
          model: this.embeddingModel,
          input: text.trim(),
        });

        const embedding = response.data[0].embedding;

        if (
          !embedding ||
          embedding.length === 0 ||
          embedding.every((v) => v === 0)
        ) {
          console.error("Received invalid embedding from API");

          if (attempt === this.retryConfig.maxRetries - 1) {
            return new Array(768).fill(0.1);
          }

          continue;
        }

        return embedding;
      } catch (error) {
        console.error(`Embedding error on attempt ${attempt + 1}:`, error);

        if (attempt === this.retryConfig.maxRetries - 1) {
          return new Array(768).fill(0.1);
        }

        const backoffTime = this.calculateBackoff(attempt);
        await this.delay(backoffTime);
      }
    }

    return new Array(768).fill(0.1);
  }
}
