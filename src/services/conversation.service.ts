import { EventEmitter } from "events";
import type {
  ConversationState,
  Message,
  Event,
} from "../types/conversation.types";
import type { Agent } from "../types/agent.types";
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { ConversationDynamics } from "../utils/conversation-dynamics";
import { TopicDetector } from "../utils/topic-detector";
import { StyleManager } from "../utils/style-manager";
import { ConversationStyle } from "../types/common.types";

// Define the match type
interface QueryMatch {
  id: string;
  score: number;
  metadata: {
    content: string;
    timestamp: number;
    agentId: string;
    role: "assistant" | "user";
    topics?: string[];
    style?: string;
    sentiment?: string;
  };
}

export class ConversationService extends EventEmitter {
  private conversations: Map<string, Message[]> = new Map();
  private dynamics: ConversationDynamics;
  private topicDetector: TopicDetector;
  private styleManager: StyleManager;

  constructor(
    private togetherService: TogetherService,
    private vectorStore: VectorStoreService
  ) {
    super();
    this.dynamics = new ConversationDynamics();
    this.topicDetector = new TopicDetector();
    this.styleManager = new StyleManager();
  }

  async generateMessage(conversationId: string, agent: Agent) {
    try {
      const state = this.dynamics.getState(conversationId);
      const conversation = this.getConversation(conversationId);

      // Get the last message to use as query context
      const lastMessage = conversation[conversation.length - 1];

      // Generate embedding for the last message if it exists
      let relevantMemories: QueryMatch[] = [];
      if (lastMessage?.content) {
        const embedding = await this.togetherService.createEmbedding(
          lastMessage.content
        );

        // Query vector store for relevant context
        const queryResult = await this.vectorStore.query({
          vector: embedding,
          topK: 5,
          filter: {
            agentId: agent.id,
            conversationId: conversationId,
          },
        });

        relevantMemories = queryResult.matches as QueryMatch[];
      }

      if (this.shouldMaintainSilence(state)) {
        return "[Comfortable silence...]";
      }

      const systemPrompt = this.buildSystemPrompt(
        agent,
        state,
        relevantMemories
      );

      // Generate response using the full conversation history
      const response = await this.togetherService.generateResponse(
        agent,
        conversation, // Pass the full conversation history
        systemPrompt
      );

      // Create and store the agent's response message
      const message: Message = {
        id: crypto.randomUUID(),
        agentId: agent.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        style: state.currentStyle,
        topics: Array.from(await this.topicDetector.detectTopics(response)),
      };

      // Add to conversation history
      conversation.push(message);
      this.conversations.set(conversationId, conversation);

      // Update conversation dynamics
      this.dynamics.updateState(conversationId, message);
      this.emit("messageCreated", { conversationId, message });

      return response;
    } catch (error) {
      console.error("Generation error:", error);
      throw error;
    }
  }

  private shouldMaintainSilence(state: ConversationState): boolean {
    return Math.random() < state.silenceProbability;
  }

  private buildSystemPrompt(
    agent: Agent,
    state: ConversationState,
    memories: QueryMatch[]
  ): string {
    const memoryContext =
      memories.length > 0
        ? `Relevant conversation history:
${memories.map((m) => `- ${m.metadata.content}`).join("\n")}`
        : "No relevant conversation history.";

    return `${agent.systemPrompt}

Current conversation context:
${memoryContext}

Conversation state:
- Style: ${state.currentStyle}
- Momentum: ${state.momentum}
- Emotional state: ${state.emotionalState}
- Time of day: ${state.timeOfDay}

${this.styleManager.getStylePrompt(state.currentStyle)}

Instructions:
1. Stay in character as ${agent.name}
2. Maintain the current conversation style
3. Reference relevant past context naturally
4. Keep responses concise (under 100 words)
5. React appropriately to the emotional state
`;
  }

  async getConversationWithContext(
    conversationId: string,
    messageId: string
  ): Promise<Message[]> {
    const conversation = this.getConversation(conversationId);
    const message = conversation.find((m) => m.id === messageId);

    if (message) {
      const embedding = await this.togetherService.createEmbedding(
        message.content
      );
      const context = await this.vectorStore.query({
        vector: embedding,
        topK: 5,
        filter: { conversationId },
      });

      return (context.matches as QueryMatch[]).map((match) => ({
        id: match.id,
        content: match.metadata.content,
        timestamp: match.metadata.timestamp,
        agentId: match.metadata.agentId,
        role: match.metadata.role,
        style: match.metadata.style as ConversationStyle | undefined,
        topics: match.metadata.topics,
      }));
    }

    return [];
  }

  getConversation(conversationId: string): Message[] {
    return this.conversations.get(conversationId) || [];
  }

  getState(conversationId: string): ConversationState {
    return this.dynamics.getState(conversationId);
  }

  async addMessage(conversationId: string, message: Message) {
    const conversation = this.getConversation(conversationId);
    conversation.push(message);
    this.conversations.set(conversationId, conversation);

    // Add vector storage
    const embedding = await this.togetherService.createEmbedding(
      message.content
    );
    await this.vectorStore.upsert({
      id: message.id,
      values: embedding,
      metadata: {
        conversationId,
        agentId: message.agentId,
        content: message.content,
        timestamp: message.timestamp,
        role: message.role,
        topics: message.topics,
        style: message.style,
        sentiment: message.sentiment?.toString(),
      },
    });

    this.emit("messageCreated", { conversationId, message });
    return message;
  }
}
