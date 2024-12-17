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

  async generateMessage(conversationId: string, agent: Agent): Promise<string> {
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
        const queryResult = await this.vectorStore.query(
          {
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

  async getConversations(): Promise<Message[][]> {
    const conversations: Message[][] = [];
    for (const [, messages] of this.conversations) {
      if (messages.length > 0) {
        conversations.push(messages);
      }
    }
    return conversations;
  }

  async generateGroupResponse(
    conversationId: string,
    participants: Agent[],
    content: string
  ): Promise<string> {
    try {
      const state = this.dynamics.getState(conversationId);
      const conversation = this.getConversation(conversationId);

      // Create a special system prompt for group chat
      const systemPrompt = this.buildGroupChatPrompt(participants, state);

      // Generate response using the main agent's perspective
      const response = await this.togetherService.generateResponse(
        participants[0], // Use first agent as primary responder
        conversation,
        systemPrompt
      );

      // Create and store the response message
      const message: Message = {
        id: crypto.randomUUID(),
        agentId: participants[0].id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        style: state.currentStyle,
        topics: Array.from(await this.topicDetector.detectTopics(response)),
      };

      conversation.push(message);
      this.conversations.set(conversationId, conversation);
      this.dynamics.updateState(conversationId, message);

      return response;
    } catch (error) {
      console.error("Group chat error:", error);
      throw error;
    }
  }

  private buildGroupChatPrompt(
    participants: Agent[],
    state: ConversationState
  ): string {
    const participantInfo = participants
      .map(
        (agent) =>
          `${agent.name} (${
            agent.personality
          }, interests: ${agent.interests.join(", ")})`
      )
      .join("\n");

    return `Group conversation between:
${participantInfo}

Conversation state:
- Style: ${state.currentStyle}
- Momentum: ${state.momentum}
- Time of day: ${state.timeOfDay}

Instructions:
1. Maintain natural group dynamics
2. Keep responses concise
3. Stay in character for each participant
4. React to others' personalities and interests
`;
  }

  async generateAgentInteraction(
    agent1: Agent,
    agent2: Agent
  ): Promise<Message[]> {
    const conversationId = crypto.randomUUID();
    const state = this.dynamics.getState(conversationId);

    // Start with a greeting from agent1
    const greeting = await this.togetherService.generateResponse(
      agent1,
      [],
      this.buildAgentInteractionPrompt(agent1, agent2, state)
    );

    const firstMessage: Message = {
      id: crypto.randomUUID(),
      agentId: agent1.id,
      content: greeting,
      timestamp: Date.now(),
      role: "assistant",
      style: state.currentStyle,
      topics: Array.from(await this.topicDetector.detectTopics(greeting)),
    };

    // Get response from agent2
    const response = await this.togetherService.generateResponse(
      agent2,
      [firstMessage],
      this.buildAgentInteractionPrompt(agent2, agent1, state)
    );

    const secondMessage: Message = {
      id: crypto.randomUUID(),
      agentId: agent2.id,
      content: response,
      timestamp: Date.now(),
      role: "assistant",
      style: state.currentStyle,
      topics: Array.from(await this.topicDetector.detectTopics(response)),
    };

    const conversation = [firstMessage, secondMessage];
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  async getActiveInteractions(): Promise<Message[][]> {
    const activeInteractions = Array.from(this.conversations.values()).filter(
      (messages) =>
        messages.length >= 2 &&
        Date.now() - messages[messages.length - 1].timestamp < 300000 // 5 minutes
    );
    return activeInteractions;
  }

  private buildAgentInteractionPrompt(
    speaker: Agent,
    listener: Agent,
    state: ConversationState
  ): string {
    return `You are ${speaker.name}, talking to ${listener.name}.

Your personality: ${speaker.personality}
Your interests: ${speaker.interests.join(", ")}

${listener.name}'s personality: ${listener.personality}
${listener.name}'s interests: ${listener.interests.join(", ")}

Conversation state:
- Style: ${state.currentStyle}
- Time of day: ${state.timeOfDay}

Instructions:
1. Stay in character as ${speaker.name}
2. Engage with ${listener.name}'s interests and personality
3. Keep responses natural and concise
4. React to the conversation context
`;
  }
}
