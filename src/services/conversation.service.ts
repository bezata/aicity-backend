import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import {
  Message,
  ConversationState,
  ChatMetadata,
} from "../types/conversation.types";
import { ConversationStyle } from "../types/common.types";
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

interface CityConversationContext {
  location?: {
    districtId: string;
    coordinates: [number, number];
    nearbyLandmarks?: string[];
    currentActivity?: string;
  };
  urgency?: number;
  topic?: string;
  collaborationId?: string;
  cityMetrics?: {
    activityLevel: number;
    emergencyStatus: string;
    weatherConditions: string;
    culturalEvents: string[];
  };
  districtContext?: {
    population: number;
    mainActivities: string[];
    currentIssues: string[];
    developmentProjects: string[];
  };
}

export class ConversationService extends EventEmitter {
  private readonly CONVERSATION_EXPIRY = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_HISTORY_LENGTH = 100;
  private readonly TOPIC_EXHAUSTION_THRESHOLD = 5;

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
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Listen for emergency events to adjust conversation priorities
    this.emergencyService.on("emergency", async (emergency) => {
      const affectedConversations = await this.findConversationsInArea(
        emergency.location,
        emergency.affectedArea.radius
      );
      for (const conv of affectedConversations) {
        await this.injectEmergencyContext(conv, emergency);
      }
    });

    // Listen for cultural events
    this.cityEvents.on("eventCreated", async (event) => {
      const nearbyConversations = await this.findConversationsInArea(
        event.location,
        500 // 500m radius
      );
      for (const conv of nearbyConversations) {
        await this.injectCulturalContext(conv, event);
      }
    });

    // Monitor city mood changes
    this.cityService.on("moodUpdate", async (mood) => {
      await this.adjustConversationStyles(mood);
    });
  }

  private async findConversationsInArea(
    location: any,
    radius: number
  ): Promise<string[]> {
    const result = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `location: ${JSON.stringify(location)}`
      ),
      filter: {
        type: { $eq: "conversation" },
        timestamp: { $gt: Date.now() - this.CONVERSATION_EXPIRY },
      },
      topK: 20,
    });

    return result.matches
      .filter((match: { metadata: { coordinates: [number, number] } }) =>
        this.isWithinRadius(match.metadata.coordinates, location, radius)
      )
      .map(
        (match: { metadata: { conversationId: string } }) =>
          match.metadata.conversationId
      );
  }

  private isWithinRadius(
    point1: [number, number],
    point2: [number, number],
    radius: number
  ): boolean {
    if (!point1 || !point2) return false;
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance <= radius;
  }

  private async injectEmergencyContext(conversationId: string, emergency: any) {
    const systemMessage: Message = {
      id: crypto.randomUUID(),
      agentId: "system",
      content: `⚠️ EMERGENCY ALERT: ${emergency.description}. Please be aware and adjust your activities accordingly.`,
      timestamp: Date.now(),
      role: "assistant",
      metadata: {
        emergencyId: emergency.id,
        type: emergency.type,
        severity: emergency.priority,
        isEmergency: true,
      },
    };
    await this.addMessage(conversationId, "system", systemMessage.content);
  }

  private async injectCulturalContext(conversationId: string, event: any) {
    const systemMessage: Message = {
      id: crypto.randomUUID(),
      agentId: "system",
      content: `🎉 Cultural Event: "${event.title}" is happening nearby. This might be relevant to your conversation.`,
      timestamp: Date.now(),
      role: "assistant",
      metadata: {
        eventId: event.id,
        type: event.type,
        culturalImpact: event.culturalImpact,
      },
    };
    await this.addMessage(conversationId, "system", systemMessage.content);
  }

  private async adjustConversationStyles(cityMood: any) {
    const activeConversations = await this.getActiveInteractions();
    for (const conversation of activeConversations) {
      const newStyle = this.determineConversationStyle(cityMood, conversation);
      await this.updateConversationStyle(conversation[0]?.id, newStyle);
    }
  }

  private determineConversationStyle(
    cityMood: any,
    conversation: Message[]
  ): ConversationStyle {
    const moodValue = cityMood.overall;
    const hasEmergency = conversation.some((m) => m.metadata?.isEmergency);

    if (hasEmergency) return "formal";
    if (moodValue > 0.7) return "casual";
    if (moodValue < 0.3) return "supportive";
    return "formal";
  }

  private async updateConversationStyle(
    conversationId: string,
    style: ConversationStyle
  ) {
    await this.vectorStore.upsert({
      id: `style-${conversationId}`,
      values: await this.vectorStore.createEmbedding(
        `conversation style ${style}`
      ),
      metadata: {
        type: "conversation",
        conversationId,
        style,
        timestamp: Date.now(),
      },
    });
  }

  async generateMessage(
    agent: Agent,
    context: CityConversationContext = {}
  ): Promise<string> {
    // Get city context
    const cityContext = await this.cityService.getContext();
    const cityMetrics = {
      activityLevel: await this.cityService.getActivityLevel(),
      emergencyStatus: await this.cityService.getEmergencyStatus(),
      weatherConditions: (await this.cityService.getCurrentWeather()).condition,
      culturalEvents: await this.cityEvents.getCurrentEvents(),
    };

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

    // Build enhanced prompt with city-specific context
    const prompt = this.buildEnhancedPrompt(agent, {
      cityContext,
      cityMetrics,
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

    // Store in vector database with enhanced metadata
    await this.storeConversationContext(agent, response, {
      ...context,
      cityMetrics,
    });

    // Handle any emergency responses if needed
    if (isEmergency) {
      await this.handleEmergencyResponse(agent, response, context);
    }

    return response;
  }

  private buildEnhancedPrompt(agent: Agent, context: any): string {
    return `You are ${agent.name}, ${agent.personality}.

Current City Context:
${this.formatCityContext(context.cityContext)}
${this.formatCityMetrics(context.cityMetrics)}

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

${context.isEmergency ? "🚨 URGENT: Immediate response required." : ""}

Location: ${
      context.location
        ? `${context.location.districtId} district${
            context.location.nearbyLandmarks
              ? `, near ${context.location.nearbyLandmarks.join(", ")}`
              : ""
          }`
        : "Unspecified"
    }
Current Activity: ${context.location?.currentActivity || "None specified"}
Topic: ${context.topic || "General conversation"}

Consider:
1. Your role and expertise
2. Current city conditions and metrics
3. Cultural sensitivities and ongoing events
4. Historical context and district-specific issues
5. Ongoing collaborations and activities
6. Emergency protocols if applicable
7. Local landmarks and spatial context
8. Current city mood and social dynamics

Respond naturally while maintaining your character and considering all available context.`;
  }

  private formatCityMetrics(metrics?: any): string {
    if (!metrics) return "";
    return `
City Metrics:
- Activity Level: ${(metrics.activityLevel * 100).toFixed(1)}%
- Emergency Status: ${metrics.emergencyStatus}
- Weather: ${metrics.weatherConditions}
- Active Cultural Events: ${metrics.culturalEvents.length}`;
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

  private messageFromMetadata(match: {
    id: string;
    metadata: ChatMetadata;
  }): Message {
    return {
      id: match.id,
      agentId: match.metadata.agentId,
      content: match.metadata.content || "",
      timestamp: match.metadata.timestamp,
      role: (match.metadata.role as "assistant" | "user") || "assistant",
      sentiment: match.metadata.sentiment
        ? parseFloat(match.metadata.sentiment)
        : undefined,
      topics: match.metadata.topics,
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

  async generateGroupResponse(
    agents: Agent[],
    context: {
      location?: { districtId: string; coordinates: [number, number] };
      urgency?: number;
      topic?: string;
      collaborationId?: string;
    } = {}
  ): Promise<string> {
    const responses = await Promise.all(
      agents.map((agent) => this.generateMessage(agent, context))
    );

    // Combine responses and generate a cohesive group response
    const combinedContext = responses.join("\n\n");
    const groupPrompt = `Based on the following agent responses, generate a cohesive group response that incorporates the key points and maintains consensus:\n\n${combinedContext}`;

    const sentimentAnalyzer: Agent = {
      id: "group-response",
      name: "Group Response Generator",
      personality: "analytical",
      systemPrompt:
        "Generate a cohesive group response that maintains consensus.",
      interests: ["group dynamics"],
      preferredStyle: "formal" as ConversationStyle,
      traits: {
        curiosity: 0.5,
        enthusiasm: 0.5,
        formality: 0.8,
        empathy: 0.8,
        analyticalThinking: 1,
        creativity: 0.7,
      },
      memoryWindowSize: 5,
      emotionalRange: {
        min: 0,
        max: 1,
      },
    };

    return await this.togetherService.generateResponse(sentimentAnalyzer, [
      {
        id: crypto.randomUUID(),
        agentId: "system",
        content: groupPrompt,
        timestamp: Date.now(),
        role: "user",
      },
    ]);
  }

  async getConversation(conversationId: string): Promise<Message[]> {
    const messages = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `conversation ${conversationId}`
      ),
      filter: {
        type: { $eq: "conversation" },
        conversationId: { $eq: conversationId },
      },
      topK: 100,
    });

    return messages.matches
      .map((match: { id: string; metadata: ChatMetadata }) =>
        this.messageFromMetadata(match)
      )
      .sort((a: Message, b: Message) => a.timestamp - b.timestamp);
  }

  async getState(conversationId: string): Promise<ConversationState> {
    const messages = await this.getConversation(conversationId);
    const lastMessage = messages[messages.length - 1];
    const now = Date.now();

    return {
      conversationId,
      lastMessageTimestamp: lastMessage?.timestamp || now,
      lastInteractionTime: lastMessage?.timestamp || now,
      messageCount: messages.length,
      participants: Array.from(new Set(messages.map((m) => m.agentId))),
      topics: this.aggregateTopics(messages),
      currentTopics: new Set(this.aggregateTopics(messages)),
      sentiment: this.calculateAverageSentiment(messages),
      status: this.determineConversationStatus(messages),
      momentum: messages.length > 0 ? Math.min(1, messages.length / 10) : 0,
      silenceDuration: lastMessage ? now - lastMessage.timestamp : 0,
      silenceProbability: lastMessage
        ? Math.min(1, (now - lastMessage.timestamp) / (30 * 60 * 1000))
        : 1,
      interactionCount: messages.length,
      timeOfDay: new Date().toLocaleTimeString(),
      topicExhaustion: new Map(
        this.aggregateTopics(messages).map((topic) => [topic, 0])
      ),
      currentStyle: "casual",
      emotionalState: 0,
      turnsInCurrentTopic: 0,
    };
  }

  private aggregateTopics(messages: Message[]): string[] {
    const topics = new Set<string>();
    messages.forEach((message) => {
      message.topics?.forEach((topic) => topics.add(topic));
    });
    return Array.from(topics);
  }

  private calculateAverageSentiment(messages: Message[]): number {
    const sentiments = messages
      .map((m) => m.sentiment)
      .filter((s): s is number => s !== undefined);
    return sentiments.length
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : 0.5;
  }

  private determineConversationStatus(
    messages: Message[]
  ): ConversationState["status"] {
    if (messages.length === 0) return "inactive";
    const lastMessageTime = messages[messages.length - 1].timestamp;
    const timeSinceLastMessage = Date.now() - lastMessageTime;

    if (timeSinceLastMessage > 30 * 60 * 1000) return "inactive"; // 30 minutes
    if (timeSinceLastMessage > 5 * 60 * 1000) return "idle"; // 5 minutes
    return "active";
  }

  async getConversations(): Promise<Message[][]> {
    const messages = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding("all conversations"),
      filter: {
        type: { $eq: "conversation" },
      },
      topK: 1000,
    });

    const conversationMap = new Map<string, Message[]>();

    messages.matches.forEach(
      (match: { id: string; metadata: ChatMetadata }) => {
        const conversationId = match.metadata.conversationId;
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, []);
        }
        conversationMap
          .get(conversationId)
          ?.push(this.messageFromMetadata(match));
      }
    );

    return Array.from(conversationMap.values()).map((messages) =>
      messages.sort((a, b) => a.timestamp - b.timestamp)
    );
  }

  private async storeConversationContext(
    agent: Agent,
    response: string,
    context: CityConversationContext & { cityMetrics?: any }
  ) {
    const coordinates = context.location?.coordinates;
    await this.vectorStore.upsert({
      id: `conv-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(response),
      metadata: {
        type: "conversation",
        agentId: agent.id,
        districtId: context.location?.districtId,
        coordinates: coordinates
          ? [`${coordinates[0]}`, `${coordinates[1]}`]
          : undefined,
        activityLevel: context.cityMetrics?.activityLevel?.toString() || "0",
        status: context.cityMetrics?.emergencyStatus || "normal",
        timestamp: Date.now(),
      },
    });
  }

  private async handleEmergencyResponse(
    agent: Agent,
    response: string,
    context: CityConversationContext
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
}
