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

      if (this.shouldMaintainSilence(state)) {
        return "[Comfortable silence...]";
      }

      const conversation = this.getConversation(conversationId);
      const memories = await this.vectorStore.queryRelevantMemories(
        conversation[conversation.length - 1]?.content || "",
        agent.id
      );

      const systemPrompt = this.buildSystemPrompt(agent, state, memories);

      const messageContent = await this.togetherService.generateResponse(
        agent,
        conversation,
        systemPrompt
      );

      // Create and store the complete message
      const message: Message = {
        id: crypto.randomUUID(),
        agentId: agent.id,
        content: messageContent,
        timestamp: Date.now(),
        role: "assistant",
        style: state.currentStyle,
        topics: Array.from(
          await this.topicDetector.detectTopics(messageContent)
        ),
      };

      // Update conversation state
      conversation.push(message);
      this.conversations.set(conversationId, conversation);
      await this.vectorStore.storeMessage(message);

      this.dynamics.updateState(conversationId, message);
      this.emit("messageCreated", { conversationId, message });

      return messageContent;
    } catch (error) {
      console.error("Generation error:", error);
      return JSON.stringify({
        error: "Message generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private shouldMaintainSilence(state: ConversationState): boolean {
    return Math.random() < state.silenceProbability;
  }

  private buildSystemPrompt(
    agent: Agent,
    state: ConversationState,
    memories: any[]
  ): string {
    return `${agent.systemPrompt}

Current conversation state:
- Style: ${state.currentStyle}
- Momentum: ${state.momentum}
- Emotional state: ${state.emotionalState}
- Time of day: ${state.timeOfDay}

${
  memories.length > 0
    ? `Relevant memories:
${memories.map((m) => `- ${m.content}`).join("\n")}`
    : ""
}

${this.styleManager.getStylePrompt(state.currentStyle)}

Remember to:
1. Stay in character
2. Maintain conversation style
3. React to context and memories naturally
4. Keep responses concise (under 100 words)
`;
  }

  getConversation(conversationId: string): Message[] {
    return this.conversations.get(conversationId) || [];
  }

  getState(conversationId: string): ConversationState {
    return this.dynamics.getState(conversationId);
  }
}
