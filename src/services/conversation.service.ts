import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import { Message } from "../types/conversation.types";
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { CityService } from "./city.service";
import { AgentCollaborationService } from "./agent-collaboration.service";
import { CityMemoryService } from "./city-memory.service";
import { SpatialCoordinationService } from "./spatial-coordination.service";
import { AgentCultureService } from "./agent-culture.service";
import { EmergencyService } from "./emergency.service";
import { CityEventsService } from "./city-events.service";
import { EmergencyType } from "../types/emergency.types";

export class ConversationService extends EventEmitter {
  constructor(
    private togetherService: TogetherService,
    private vectorStore: VectorStoreService,
    private cityService: CityService,
    private agentCollaboration: AgentCollaborationService,
    private cityMemory: CityMemoryService,
    private spatialCoordination: SpatialCoordinationService,
    private agentCulture: AgentCultureService,
    private emergencyService: EmergencyService,
    private cityEvents: CityEventsService
  ) {
    super();
  }

  async generateMessage(
    agent: Agent,
    context: {
      location?: { districtId: string; coordinates: [number, number] };
      urgency?: number;
      topic?: string;
      collaborationId?: string;
    } = {}
  ): Promise<string> {
    // Get city context
    const cityContext = await this.cityService.getContext();

    // Get cultural context if available
    const culturalContext = context.location
      ? await this.agentCulture.enrichAgentContext(
          agent,
          context.location.districtId
        )
      : undefined;

    // Check for ongoing collaborations
    const activeCollaboration = context.collaborationId
      ? await this.agentCollaboration.getSessionStatus(context.collaborationId)
      : undefined;

    // Check for relevant memories
    const relevantMemories = context.location
      ? await this.cityMemory.getDistrictMemories(context.location.districtId)
      : undefined;

    // Check for emergency situations
    const isEmergency = context.urgency && context.urgency > 0.8;

    // Build enhanced prompt
    const prompt = this.buildEnhancedPrompt(agent, {
      cityContext,
      culturalContext,
      activeCollaboration,
      relevantMemories,
      isEmergency,
      ...context,
    });

    // Generate response
    const response = await this.togetherService.generateResponse(agent, [
      {
        id: crypto.randomUUID(),
        agentId: "system",
        content: prompt,
        timestamp: Date.now(),
        role: "user",
      },
    ]);

    // Store in vector database
    await this.storeConversationContext(agent, response, context);

    // Handle any emergency responses if needed
    if (isEmergency) {
      await this.handleEmergencyResponse(agent, response, context);
    }

    return response;
  }

  private async storeConversationContext(
    agent: Agent,
    response: string,
    context: any
  ) {
    await this.vectorStore.upsert({
      id: `conv-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(response),
      metadata: {
        type: "conversation",
        agentId: agent.id,
        districtId: context.location?.districtId,
        coordinates: context.location?.coordinates,
        timestamp: Date.now(),
      },
    });
  }

  private async handleEmergencyResponse(
    agent: Agent,
    response: string,
    context: any
  ) {
    if (context.location) {
      await this.emergencyService.handleEmergency({
        id: `emergency-${Date.now()}`,
        type: EmergencyType.MEDICAL,
        description: response,
        location: context.location,
        priority: "high",
        timestamp: Date.now(),
        affectedArea: {
          districtIds: [context.location.districtId],
          radius: 100,
        },
        status: "reported",
        responseUnits: [],
      });
    }
  }

  private buildEnhancedPrompt(agent: Agent, context: any): string {
    return `You are ${agent.name}, ${agent.personality}.

Current City Context:
${this.formatCityContext(context.cityContext)}

${
  context.culturalContext
    ? this.formatCulturalContext(context.culturalContext)
    : ""
}
${
  context.activeCollaboration
    ? this.formatCollaborationContext(context.activeCollaboration)
    : ""
}
${
  context.relevantMemories
    ? this.formatMemoryContext(context.relevantMemories)
    : ""
}

${context.isEmergency ? "URGENT: Immediate response required." : ""}

Location: ${
      context.location
        ? `${context.location.districtId} district`
        : "Unspecified"
    }
Topic: ${context.topic || "General conversation"}

Consider:
1. Your role and expertise
2. Current city conditions
3. Cultural sensitivities
4. Historical context
5. Ongoing collaborations
6. Emergency protocols if applicable

Respond naturally while maintaining your character and considering all available context.`;
  }

  private formatCityContext(context: any): string {
    return `- Weather: ${context.weather.condition}, ${
      context.weather.temperature
    }°C
- City Mood: ${context.mood.dominantEmotion}
- Community Status: ${context.mood.factors.community.toFixed(2)}
- Stress Level: ${context.mood.factors.stress.toFixed(2)}`;
  }

  private formatCulturalContext(context: any): string {
    return `Cultural Context:
- Cultural Sensitivity: ${context.culturalSensitivity.toFixed(2)}
- Community Engagement: ${context.communityEngagement.level.toFixed(2)}
- Active Cultural Events: ${context.currentEvents.length}`;
  }

  private formatCollaborationContext(collaboration: any): string {
    return `Active Collaboration:
- Status: ${collaboration.status}
- Progress: ${(collaboration.metrics.progressRate * 100).toFixed(1)}%
- Consensus Level: ${(collaboration.metrics.consensusLevel * 100).toFixed(1)}%`;
  }

  private formatMemoryContext(memories: any): string {
    return `Relevant District Memories:
${memories.memories
  .slice(0, 3)
  .map((m: any) => `- ${m.description}`)
  .join("\n")}`;
  }

  async addMessage(
    conversationId: string,
    agentId: string,
    content: string
  ): Promise<void> {
    const sentiment = await this.analyzeSentiment(content);
    const topics = await this.extractTopics(content);

    const message: Message = {
      id: crypto.randomUUID(),
      agentId,
      content,
      timestamp: Date.now(),
      role: "assistant",
      sentiment,
      topics,
    };

    await this.vectorStore.upsert({
      id: `message-${message.id}`,
      values: await this.vectorStore.createEmbedding(content),
      metadata: {
        type: "conversation",
        conversationId,
        agentId,
        sentiment: sentiment?.toString(),
        timestamp: message.timestamp,
      },
    });

    this.emit("messageAdded", { conversationId, message });
  }

  async generateAgentInteraction(
    agent1: Agent,
    agent2: Agent
  ): Promise<Message[]> {
    const conversationId = crypto.randomUUID();

    // Generate initial message from agent1
    const context1 = await this.buildInteractionContext(agent1, agent2);
    const message1 = await this.generateMessage(agent1, context1);

    // Get response from agent2
    const context2 = await this.buildInteractionContext(
      agent2,
      agent1,
      message1
    );
    const message2 = await this.generateMessage(agent2, context2);

    const messages = [
      await this.createMessage(agent1.id, message1),
      await this.createMessage(agent2.id, message2),
    ];

    return messages;
  }

  async getActiveInteractions(): Promise<Message[][]> {
    const recentMessages = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        "recent agent interactions"
      ),
      filter: {
        type: { $eq: "conversation" },
        timestamp: { $gt: Date.now() - 5 * 60 * 1000 }, // Last 5 minutes
      },
      topK: 100,
    });

    const conversations = new Map<string, Message[]>();

    for (const match of recentMessages.matches) {
      const conversationId = match.metadata.conversationId;
      if (!conversations.has(conversationId)) {
        conversations.set(conversationId, []);
      }
      conversations.get(conversationId)?.push(this.messageFromMetadata(match));
    }

    return Array.from(conversations.values());
  }

  private async buildInteractionContext(
    agent: Agent,
    otherAgent: Agent,
    previousMessage?: string
  ): Promise<any> {
    return {
      topic: `Interaction with ${otherAgent.name}`,
      previousMessage,
      otherAgentPersonality: otherAgent.personality,
      otherAgentInterests: otherAgent.interests,
    };
  }

  private async createMessage(
    agentId: string,
    content: string
  ): Promise<Message> {
    return {
      id: crypto.randomUUID(),
      agentId,
      content,
      timestamp: Date.now(),
      role: "assistant",
    };
  }

  private messageFromMetadata(match: any): Message {
    return {
      id: match.id,
      agentId: match.metadata.agentId,
      content: match.metadata.content,
      timestamp: match.metadata.timestamp,
      role: "assistant",
      sentiment: parseFloat(match.metadata.sentiment),
      topics: match.metadata.topics?.split(","),
    };
  }

  private async analyzeSentiment(content: string): Promise<number> {
    // Simple sentiment analysis implementation
    const positiveWords = /good|great|excellent|happy|positive/gi;
    const negativeWords = /bad|poor|terrible|sad|negative/gi;

    const positiveCount = (content.match(positiveWords) || []).length;
    const negativeCount = (content.match(negativeWords) || []).length;

    return (positiveCount - negativeCount + 1) / 2; // Normalize to 0-1
  }

  private async extractTopics(content: string): Promise<string[]> {
    // Simple topic extraction
    const topics = new Set<string>();
    const commonTopics = {
      technology: /tech|digital|software|computer/i,
      environment: /nature|climate|green|eco/i,
      social: /community|people|social|cultural/i,
      economy: /business|economy|market|financial/i,
    };

    Object.entries(commonTopics).forEach(([topic, pattern]) => {
      if (pattern.test(content)) {
        topics.add(topic);
      }
    });

    return Array.from(topics);
  }
}
