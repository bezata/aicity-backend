import { EventEmitter } from "events";
import { Agent, AgentTraits } from "../types/agent.types";
import {
  Message,
  ConversationState,
  ConversationStatus,
} from "../types/conversation.types";
import { VectorStoreService } from "./vector-store.service";
import { CityCoordinatorService } from "./city-coordinator.service";
import { AIIntegrationService } from "./ai-integration.service";
import { SocialDynamicsService } from "./social-dynamics.service";
import { CultureService } from "./culture.service";
import { TogetherService } from "./together.service";
import { DistrictService } from "./district.service";

interface SystemProtocol {
  name: string;
  version: string;
  rules: string[];
}

interface AgentInteraction {
  agentId: string;
  type: string;
  sentiment: number;
  timestamp: number;
}

interface ConversationContext {
  districtId: string;
  activity: string;
  socialMood: {
    positivity: number;
    engagement: number;
  };
  culturalContext: {
    events: any[];
    traditions: any[];
  };
}

export interface AgentConversation {
  id: string;
  participants: Agent[];
  messages: Message[];
  topic: string;
  districtId: string;
  location: string;
  activity: string;
  startTime: number;
  endTime?: number;
  lastUpdateTime: number;
  status: ConversationStatus;
  sentiment: number;
  socialContext: {
    communityMood: number;
    engagement: number;
    activityType: string;
    participants: number;
  };
  culturalContext: {
    currentEvents: any[];
    traditions: any[];
    atmosphere: {
      harmonyIndex: number;
      culturalTension: number;
      mood: string;
    };
  };
  conversationId: string;
  lastMessageTimestamp: number;
  lastInteractionTime: number;
  messageCount: number;
  topics: string[];
  currentTopics: Set<string>;
  momentum: number;
  silenceDuration: number;
  silenceProbability: number;
  interactionCount: number;
  timeOfDay: string;
  topicExhaustion: Map<string, number>;
  currentStyle: string;
  emotionalState: number;
  turnsInCurrentTopic: number;
  participantEngagement: Map<string, number>;
  topicHistory: Array<{ topic: string; duration: number; engagement: number }>;
  contextualRelevance: number;
  naturalTransitions: number;
  conversationDepth: number;
  emotionalDynamics: {
    tension: number;
    agreement: number;
    empathy: number;
  };
  interactionPatterns: {
    turnTakingBalance: number;
    responseLatency: number[];
    topicInitiationCount: Map<string, number>;
  };
  environmentalContext: {
    noise: number;
    crowding: number;
    timeConstraints: boolean;
  };
}

interface AgentActivity {
  timeSlot: number;
  activity: string;
  location: string;
  possibleTopics: string[];
  socialProbability: number;
}

interface AgentSocialProfile {
  friends: Set<string>;
  regularLocations: string[];
  recentInteractions: AgentInteraction[];
  culturalPreferences: string[];
  routines: AgentActivity[];
  personality: {
    extroversion: number;
    culturalOpenness: number;
    communityOrientation: number;
  };
}

export class AgentConversationService extends EventEmitter {
  private activeConversations: Map<string, AgentConversation> = new Map();
  private agentProfiles: Map<string, AgentSocialProfile> = new Map();
  private districtActivities: Map<string, Map<string, string[]>> = new Map();
  private registeredAgents: Map<string, Agent> = new Map();
  private readonly maxConversationDuration = 20 * 60 * 1000; // 20 minutes
  private readonly minConversationDuration = 10 * 60 * 1000; // 10 minutes minimum
  private readonly messageInterval = 60000; // 30 seconds between messages
  private readonly maxConcurrentConversations = 1; // Maximum concurrent conversations
  private readonly minConversationCooldown = 60000; // 30 seconds cooldown between conversations
  private readonly TOPIC_EXHAUSTION_THRESHOLD = 5; // Number of messages before topic switch
  private readonly USER_MESSAGE_RESPONSE_DELAY = 2000; // 2 seconds delay between agent responses to user
  private lastConversationTime: number = 0;
  private dailyAPICallCount: number = 0;
  private readonly maxDailyAPICalls: number = 100000; // Limit daily API calls
  private readonly conversationStartHour: number = 0; // Start conversations at 8 AM
  private readonly conversationEndHour: number = 24; // End conversations at 10 PM
  private messageCache: Map<string, { content: string; timestamp: number }> =
    new Map();
  private readonly cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
  private agentConversationCounts: Map<
    string,
    { count: number; lastTime: number }
  > = new Map();
  private readonly maxDailyConversationsPerAgent = 10000;
  private conversationTopics: string[] = [
    "district_development",
    "local_events",
    "community_projects",
    "cultural_activities",
    "neighborhood_improvements",
  ];
  private currentTopicIndex = 0;
  private readonly dynamicCooldownMultiplier = 0.1; // Increases cooldown when API usage is high
  private conversationQualityScores: Map<string, number> = new Map();
  private readonly minQualityThreshold = 0.6;

  // Add new delay configuration
  private messageDelayConfig = {
    minDelay: 5000, // Minimum delay between messages (5 seconds)
    maxDelay: 10000, // Maximum delay between messages (10 seconds)
    responseDelay: 5000, // Delay before agent responds (3 seconds)
    typingSpeed: 100, // Milliseconds per character for typing simulation
  };

  // Add method to update delay configuration
  public updateMessageDelayConfig(
    config: Partial<typeof this.messageDelayConfig>
  ) {
    this.messageDelayConfig = {
      ...this.messageDelayConfig,
      ...config,
    };
  }

  // Add method to get current delay configuration
  public getMessageDelayConfig() {
    return { ...this.messageDelayConfig };
  }

  private async simulateTyping(messageLength: number): Promise<void> {
    const typingDuration = messageLength * this.messageDelayConfig.typingSpeed;
    await new Promise((resolve) => setTimeout(resolve, typingDuration));
  }

  private async addMessageWithDelay(conversationId: string, message: Message) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    // Add initial response delay
    await new Promise((resolve) =>
      setTimeout(resolve, this.messageDelayConfig.responseDelay)
    );

    // Simulate typing
    await this.simulateTyping(message.content.length);

    conversation.messages.push(message);
    conversation.lastUpdateTime = Date.now();

    // Update sentiment
    conversation.sentiment = await this.calculateConversationSentiment(
      conversation.messages
    );

    // Broadcast message
    this.districtService.broadcastMessage(conversation.districtId, {
      type: "agent_conversation",
      data: {
        conversationId,
        message: {
          content: message.content,
          agentName: this.getAgent(message.agentId)?.name,
          agentRole: this.getAgent(message.agentId)?.role,
          timestamp: message.timestamp,
        },
        location: conversation.location,
        activity: conversation.activity,
        topic: conversation.topic,
      },
    });

    this.emit("message:added", { conversationId, message });

    // Add random delay before next message
    const nextMessageDelay =
      Math.floor(
        Math.random() *
          (this.messageDelayConfig.maxDelay -
            this.messageDelayConfig.minDelay +
            1)
      ) + this.messageDelayConfig.minDelay;

    await new Promise((resolve) => setTimeout(resolve, nextMessageDelay));
  }

  constructor(
    private vectorStore: VectorStoreService,
    private cityCoordinator: CityCoordinatorService,
    private aiIntegration: AIIntegrationService,
    private socialDynamics: SocialDynamicsService,
    private cultureService: CultureService,
    private togetherService: TogetherService,
    private districtService: DistrictService
  ) {
    super();
    this.initializeService().catch((error) => {
      console.error("Failed to initialize service:", error);
    });

    // Set up daily reset at midnight
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.resetDailyCounts();
      }
    }, 60 * 1000); // Check every minute
  }

  public async registerAgent(agent: Agent): Promise<void> {
    this.registeredAgents.set(agent.id, agent);

    // Generate AI-powered routines or fall back to initial routines
    const routines = await this.generateAIRoutines(agent).catch(() =>
      this.generateInitialRoutines()
    );

    this.agentProfiles.set(agent.id, {
      friends: new Set(),
      regularLocations: [
        agent.districtId || "a42ed892-3878-45a5-9a1a-4ceaf9524f1c",
      ],
      recentInteractions: [],
      culturalPreferences: agent.interests,
      routines,
      personality: {
        extroversion: agent.traits.enthusiasm || 0.5,
        culturalOpenness: agent.traits.curiosity || 0.5,
        communityOrientation: agent.traits.empathy || 0.5,
      },
    });
  }

  public async getActiveConversations(): Promise<AgentConversation[]> {
    return Array.from(this.activeConversations.values()).filter(
      (conv) => conv.status === "active"
    );
  }

  public async initiateAgentActivity(agent: Agent): Promise<void> {
    const profile = this.agentProfiles.get(agent.id);
    if (!profile) return;

    const currentHour = new Date().getHours();
    const currentActivity = profile.routines.find(
      (r) => r.timeSlot === currentHour
    );

    if (!currentActivity) return;

    // Find potential conversation partners in the same location
    const potentialPartners = Array.from(this.agentProfiles.entries())
      .filter(([otherId, otherProfile]) => {
        const otherActivity = otherProfile.routines.find(
          (r) => r.timeSlot === currentHour
        );
        return (
          otherId !== agent.id &&
          otherActivity?.location === currentActivity.location
        );
      })
      .map(([id]) => id);

    if (potentialPartners.length === 0) return;

    // Start a contextual conversation
    const districtId =
      profile.regularLocations[0] || "a42ed892-3878-45a5-9a1a-4ceaf9524f1c";
    const culturalContext = await this.cultureService.getDistrictCulture(
      districtId
    );
    const socialMood = await this.socialDynamics.getCommunityMood(districtId);

    await this.startContextualConversation(
      [agent.id, ...potentialPartners.slice(0, 2)],
      {
        activity: currentActivity.activity,
        districtId,
        culturalContext,
        socialMood,
      }
    );
  }

  private generateInitialRoutines(): AgentActivity[] {
    return [
      {
        timeSlot: 9,
        activity: "Morning Activity",
        location: "District Center",
        possibleTopics: ["weather", "news", "community"],
        socialProbability: 0.7,
      },
      {
        timeSlot: 12,
        activity: "Lunch Break",
        location: "Local Café",
        possibleTopics: ["food", "culture", "events"],
        socialProbability: 0.8,
      },
      {
        timeSlot: 15,
        activity: "Afternoon Work",
        location: "Office",
        possibleTopics: ["projects", "collaboration"],
        socialProbability: 0.6,
      },
      {
        timeSlot: 17,
        activity: "Community Meeting",
        location: "Community Center",
        possibleTopics: ["development", "planning"],
        socialProbability: 0.9,
      },
      {
        timeSlot: 19,
        activity: "Evening Recreation",
        location: "Park",
        possibleTopics: ["leisure", "hobbies"],
        socialProbability: 0.7,
      },
    ];
  }

  public async generateAIRoutines(agent: Agent): Promise<AgentActivity[]> {
    try {
      // First try to retrieve from Pinecone
      const embedding = await this.vectorStore.createEmbedding(
        `${agent.role} ${agent.personality} routines`
      );

      const results = await this.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $eq: "agent_routine" },
          agentId: { $eq: agent.id },
        },
        topK: 1,
      });

      if (results.matches?.length > 0 && results.matches[0].metadata.routines) {
        return JSON.parse(results.matches[0].metadata.routines);
      }

      const prompt = `You are a schedule generator. Generate a daily schedule for ${agent.name} (${agent.role}).
      RESPOND ONLY WITH A VALID JSON ARRAY. NO OTHER TEXT.
      Each object in array must have exactly these properties:
      {
        "timeSlot": (number 0-23),
        "activity": (string),
        "location": (string),
        "possibleTopics": (array of strings),
        "socialProbability": (number 0-1)
      }
      Generate exactly 5 activities.`;

      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
      const response = await this.togetherService.generateText(prompt);

      try {
        const cleanedResponse = response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .replace(/\n/g, "")
          .replace(/\r/g, "")
          .trim();

        const routines = JSON.parse(cleanedResponse);

        if (!Array.isArray(routines) || routines.length !== 5) {
          throw new Error("Invalid routines format");
        }

        routines.forEach((routine) => {
          if (!this.isValidRoutine(routine)) {
            throw new Error("Invalid routine object format");
          }
        });

        await this.vectorStore.upsert({
          id: `routine-${agent.id}`,
          values: embedding,
          metadata: {
            type: "agent_routine",
            agentId: agent.id,
            routines: JSON.stringify(routines),
            timestamp: Date.now(),
          },
        });

        return routines;
      } catch (parseError) {
        console.error("Failed to parse AI routines:", parseError);
        return this.generateInitialRoutines();
      }
    } catch (error) {
      console.error("Failed to generate/retrieve AI routines:", error);
      return this.generateInitialRoutines();
    }
  }

  private isValidRoutine(routine: any): boolean {
    return (
      typeof routine === "object" &&
      typeof routine.timeSlot === "number" &&
      routine.timeSlot >= 0 &&
      routine.timeSlot <= 23 &&
      typeof routine.activity === "string" &&
      typeof routine.location === "string" &&
      Array.isArray(routine.possibleTopics) &&
      routine.possibleTopics.every(
        (topic: unknown) => typeof topic === "string"
      ) &&
      typeof routine.socialProbability === "number" &&
      routine.socialProbability >= 0 &&
      routine.socialProbability <= 1
    );
  }

  private validateAndFormatRoutines(aiRoutines: any[]): AgentActivity[] {
    return aiRoutines
      .filter(
        (routine) =>
          routine.timeSlot >= 0 &&
          routine.timeSlot <= 23 &&
          routine.activity &&
          routine.location &&
          Array.isArray(routine.possibleTopics) &&
          typeof routine.socialProbability === "number" &&
          routine.socialProbability >= 0 &&
          routine.socialProbability <= 1
      )
      .map((routine) => ({
        timeSlot: routine.timeSlot,
        activity: routine.activity,
        location: routine.location,
        possibleTopics: routine.possibleTopics,
        socialProbability: routine.socialProbability,
      }));
  }

  private async initializeService() {
    try {
      const { residentAgents, cityManagementAgents } = await import(
        "../config/city-agents.ts"
      );

      const allAgents = [...residentAgents, ...cityManagementAgents];
      console.error(`Found ${allAgents.length} agents to initialize`);

      // Register all agents
      for (const agent of allAgents) {
        await this.registerAgent(agent);
      }

      // Start initial conversations immediately
      const availableAgents = [...allAgents];

      // Create initial pairs of agents based on interests
      while (availableAgents.length >= 2) {
        const agent1 = availableAgents.shift()!;
        const agent2 = availableAgents.find((a) =>
          a.interests.some((interest) => agent1.interests.includes(interest))
        );

        if (agent2) {
          availableAgents.splice(availableAgents.indexOf(agent2), 1);
          await this.initiateAgentActivity(agent1);
        }
      }

      // Set up periodic conversation generation
      setInterval(() => {
        this.generateNaturalConversations().catch(console.error);
      }, 30000);

      // Continue active conversations frequently
      setInterval(() => {
        this.continueActiveConversations().catch(console.error);
      }, 15000);
    } catch (error) {
      console.error("Error initializing agent conversation service:", error);
    }
  }

  private async generateNaturalConversations() {
    try {
      // Check rate limits first
      if (this.dailyAPICallCount >= this.maxDailyAPICalls) {
        console.log("⚠️ Daily API call limit reached");
        return;
      }

      // Check agent conversation limits
      const availableAgents = Array.from(this.registeredAgents.values()).filter(
        (agent) => {
          const counts = this.agentConversationCounts.get(agent.id);
          if (!counts) return true;

          const isWithinLimit =
            counts.count < this.maxDailyConversationsPerAgent;
          const hasPassedCooldown =
            Date.now() - counts.lastTime >
            this.minConversationCooldown *
              (1 + this.dynamicCooldownMultiplier * this.dailyAPICallCount);

          return isWithinLimit && hasPassedCooldown;
        }
      );

      if (availableAgents.length < 2) {
        console.log("⏳ Not enough available agents within limits");
        return;
      }

      const currentHour = new Date().getHours();
      if (
        currentHour < this.conversationStartHour ||
        currentHour >= this.conversationEndHour
      ) {
        console.log("⏰ Outside conversation hours");
        return;
      }

      const timeSinceLastConversation = Date.now() - this.lastConversationTime;
      if (timeSinceLastConversation < this.minConversationCooldown) {
        console.log("⏳ Conversation cooldown active");
        return;
      }

      // Check concurrent conversations limit
      const activeConversationsCount = Array.from(
        this.activeConversations.values()
      ).filter((conv) => conv.status === "active").length;

      if (activeConversationsCount >= this.maxConcurrentConversations) {
        console.log(
          `⚠️ Max concurrent conversations (${this.maxConcurrentConversations}) reached`
        );
        return;
      }

      // Get the Downtown District
      const district = await this.districtService.getDistrict(
        "a42ed892-3878-45a5-9a1a-4ceaf9524f1c"
      );
      if (!district) {
        console.error("��� District not found");
        return;
      }

      // Get all registered agents that aren't in active conversations
      const activeAgentIds = new Set(
        Array.from(this.activeConversations.values())
          .filter((conv) => conv.status === "active")
          .flatMap((conv) => conv.participants.map((p) => p.id))
      );

      if (availableAgents.length < 2) {
        console.log("⏳ Not enough available agents for new conversations");
        return;
      }

      // Select 2-3 random agents for conversation
      const participants = availableAgents
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 2));

      // Determine activity and location
      const activities = [
        "morning_coffee",
        "lunch_break",
        "evening_leisure",
        "cultural_event",
      ];
      const activity =
        activities[Math.floor(Math.random() * activities.length)];
      const location = this.determineConversationLocation(activity);

      // Get cultural and social context
      const culturalContext = await this.cultureService.getDistrictCulture(
        district.id
      );
      const socialMood = await this.socialDynamics.getCommunityMood(
        district.id
      );

      // Start the conversation
      const context: ConversationContext = {
        districtId: district.id,
        activity,
        culturalContext,
        socialMood,
      };

      await this.startContextualConversation(
        participants.map((a) => a.id),
        context
      );
      console.log(
        `🤝 Started natural conversation with ${participants.length} agents:`,
        participants.map((a) => a.name).join(", ")
      );
    } catch (error) {
      console.error("❌ Error generating natural conversation:", error);
    }
  }

  private async continueActiveConversations() {
    const activeConversations = await this.getActiveConversations();
    for (const conversation of activeConversations) {
      try {
        await this.continueConversation(conversation);
      } catch (error) {
        console.error("Error continuing conversation:", error);
      }
    }
  }

  // Add these methods to store and retrieve conversation history

  private async storeConversationInVectorDB(conversation: AgentConversation) {
    const conversationText = conversation.messages
      .map((m) => `${this.getAgentName(m.agentId)}: ${m.content}`)
      .join("\n");

    await this.vectorStore.upsert({
      id: `conversation-${conversation.id}`,
      values: await this.vectorStore.createEmbedding(conversationText),
      metadata: {
        type: "conversation",
        districtId: conversation.districtId,
        location: conversation.location,
        activity: conversation.activity,
        participants: conversation.participants.map((p) => p.id).join(","),
        sentiment: conversation.sentiment,
        topic: conversation.topic,
        timestamp: conversation.startTime,
        socialContext: JSON.stringify(conversation.socialContext),
        culturalContext: JSON.stringify(conversation.culturalContext),
      },
    });
  }

  private async getRelevantPastConversations(
    districtId: string,
    location: string,
    topic: string
  ): Promise<AgentConversation[]> {
    const query = `conversations in ${location} at ${districtId} about ${topic}`;
    const vector = await this.vectorStore.createEmbedding(query);

    const results = await this.vectorStore.query({
      vector,
      filter: {
        type: { $eq: "conversation" },
        districtId: { $eq: districtId },
      },
      topK: 5,
    });

    return results.matches.map((match: any) => ({
      id: match.id,
      districtId: match.metadata.districtId,
      location: match.metadata.location,
      topic: match.metadata.topic,
      sentiment: parseFloat(match.metadata.sentiment),
      socialContext: JSON.parse(match.metadata.socialContext),
      culturalContext: JSON.parse(match.metadata.culturalContext),
    }));
  }

  private startLifeCycles() {
    // Update agent activities every 5 minutes
    setInterval(() => this.updateAgentActivities(), 5 * 60 * 1000);

    // Generate natural conversations every 10 minutes
    setInterval(() => this.generateNaturalConversations(), 10 * 60 * 1000);

    // Update social networks every hour
    setInterval(() => this.updateSocialNetworks(), 60 * 60 * 1000);

    // Process ongoing conversations every minute
    setInterval(() => this.updateOngoingConversations(), 60 * 1000);

    // Reset daily API call count at midnight
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.dailyAPICallCount = 0;
        console.log("🔄 Reset daily API call count");
      }
    }, 60 * 1000);
  }

  private async updateAgentActivities() {
    const currentHour = new Date().getHours();
    const districts = await this.cityCoordinator.getActiveDistricts();

    for (const district of districts) {
      // Get agents in district
      const agents = Array.from(this.agentProfiles.entries()).filter(
        ([_, profile]) => profile.regularLocations.includes(district.id)
      );

      // Group by current activities
      const activities = this.groupByCurrentActivity(agents, currentHour);
      this.districtActivities.set(district.id, activities);

      // Generate interactions based on activities
      await this.processDistrictActivities(district.id, activities);
    }
  }

  private async processDistrictActivities(
    districtId: string,
    activities: Map<string, string[]>
  ) {
    const culturalContext = await this.cultureService.getDistrictCulture(
      districtId
    );
    const socialMood = await this.socialDynamics.getCommunityMood(districtId);

    for (const [activity, agents] of activities.entries()) {
      const interactionChance = this.calculateInteractionProbability(
        activity,
        socialMood,
        culturalContext
      );

      if (Math.random() < interactionChance && agents.length >= 2) {
        // Select compatible agents for interaction
        const group = this.selectInteractionGroup(agents, activity);

        // Start contextual conversation
        await this.startContextualConversation(group, {
          activity,
          districtId,
          culturalContext,
          socialMood,
        });
      }
    }
  }
  private generateContextualTopic(context: {
    activity: string;
    districtId: string;
    culturalContext: any;
    socialMood: any;
  }): string {
    // First try to use predefined topics if appropriate
    if (Math.random() < 0.3) {
      // 30% chance to use predefined topics
      const topic = this.conversationTopics[this.currentTopicIndex];
      this.currentTopicIndex =
        (this.currentTopicIndex + 1) % this.conversationTopics.length;
      return topic;
    }

    // Get base topics from activity
    const activityTopics: Record<string, string[]> = {
      morning_coffee: [
        "local cafe scene",
        "morning routines",
        "district development",
      ],
      lunch_break: [
        "local restaurants",
        "food culture",
        "community gatherings",
      ],
      evening_leisure: [
        "entertainment venues",
        "community events",
        "district lifestyle",
      ],
      cultural_event: [
        "cultural festivals",
        "local traditions",
        "arts and culture",
      ],
    };

    // Get potential topics
    const potentialTopics: string[] = [
      ...(activityTopics[context.activity] || ["district life"]),
      ...context.culturalContext.traditions,
      ...context.culturalContext.events.map((e: any) => e.type),
    ];

    // Select topic based on context
    if (context.culturalContext.events.length > 0) {
      return context.culturalContext.events[0].title;
    }

    return potentialTopics[Math.floor(Math.random() * potentialTopics.length)];
  }

  private async startContextualConversation(
    participants: string[],
    context: ConversationContext
  ): Promise<AgentConversation> {
    try {
      // Check if any participant is already in an active conversation
      const activeConversations = await this.getActiveConversations();
      const busyParticipants = participants.filter((participantId) =>
        activeConversations.some((conv) =>
          conv.participants.some((p) => p.id === participantId)
        )
      );

      if (busyParticipants.length > 0) {
        const busyAgentNames = busyParticipants
          .map((id) => this.getAgent(id)?.name)
          .filter(Boolean)
          .join(", ");
        console.log(
          `Cannot start conversation: Agents ${busyAgentNames} are already in active conversations`
        );
        throw new Error(
          "One or more participants are already in active conversations"
        );
      }

      this.lastConversationTime = Date.now();
      this.dailyAPICallCount++;

      const conversationId = `conv-${Date.now()}`;
      const conversation: AgentConversation = {
        id: conversationId,
        conversationId: conversationId,
        participants: participants
          .map((id) => this.getAgent(id))
          .filter(Boolean) as Agent[],
        messages: [],
        topic: this.generateContextualTopic(context),
        topics: [this.generateContextualTopic(context)],
        districtId: context.districtId,
        location: this.determineConversationLocation(context.activity),
        activity: context.activity,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        lastMessageTimestamp: Date.now(),
        lastInteractionTime: Date.now(),
        status: "active",
        sentiment: 0.5,
        messageCount: 0,
        currentTopics: new Set([this.generateContextualTopic(context)]),
        momentum: 0,
        silenceDuration: 0,
        silenceProbability: 0,
        interactionCount: 0,
        timeOfDay: this.getTimeOfDay(),
        topicExhaustion: new Map(),
        currentStyle: "casual",
        emotionalState: 0,
        turnsInCurrentTopic: 0,
        participantEngagement: new Map(),
        topicHistory: [],
        contextualRelevance: 0,
        naturalTransitions: 0,
        conversationDepth: 0,
        emotionalDynamics: {
          tension: 0,
          agreement: 0,
          empathy: 0,
        },
        interactionPatterns: {
          turnTakingBalance: 0,
          responseLatency: [],
          topicInitiationCount: new Map(),
        },
        environmentalContext: {
          noise: 0,
          crowding: 0,
          timeConstraints: false,
        },
        socialContext: {
          communityMood: context.socialMood.positivity,
          engagement: context.socialMood.engagement,
          activityType: context.activity,
          participants: participants.length,
        },
        culturalContext: {
          currentEvents: context.culturalContext.events,
          traditions: context.culturalContext.traditions,
          atmosphere: {
            harmonyIndex: 0.8,
            culturalTension: 0.2,
            mood: "positive",
          },
        },
      };

      this.activeConversations.set(conversation.id, conversation);
      console.error(`Message count: ${conversation.messages.length}`);

      const initiator = this.getAgent(participants[0]);
      if (!initiator) {
        throw new Error("No initiator found for conversation");
      }

      this.districtService.broadcastMessage(context.districtId, {
        type: "conversation_started",
        data: {
          conversationId: conversation.id,
          participants: conversation.participants.map((agent) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
          })),
          location: conversation.location,
          activity: conversation.activity,
          topic: conversation.topic,
          timestamp: Date.now(),
        },
      });

      const systemPrompt = `You are ${initiator.name}, a ${initiator.role} with the following personality: ${initiator.personality}.
      You are starting a conversation at ${conversation.location} during ${conversation.activity}.
      The topic is: ${conversation.topic}
      
      Generate a natural conversation opener (1-2 sentences) that fits your character and the context.`;

      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
      const initialResponse = await this.togetherService.generateResponse(
        initiator,
        [],
        systemPrompt
      );

      await this.addMessage(conversation.id, {
        id: `msg-${Date.now()}`,
        agentId: initiator.id,
        content: initialResponse,
        timestamp: Date.now(),
        role: "assistant",
      });

      if (context.districtId) {
        await this.upsertConversationToDistrict(context.districtId, {
          id: conversation.id,
          participants: conversation.participants.map((p) => p.id),
          content: initialResponse,
          topics: [conversation.topic],
          sentiment: 0.7,
          activity: context.activity,
        });
      }

      // Only continue conversation if it's not the first message and there are multiple participants
      if (
        conversation.messages.length > 1 &&
        conversation.participants.length > 1
      ) {
        setTimeout(() => {
          this.continueConversation(conversation).catch(console.error);
        }, 30000);
      }

      return conversation;
    } catch (error) {
      console.error("Error starting contextual conversation:", error);
      throw error;
    }
  }

  private generateContextualGreeting(
    agent: Agent,
    location: string,
    activity: string
  ): string {
    const timeOfDay = this.getTimeOfDay();
    const casualGreetings = [
      `Nice ${timeOfDay}! The ${location} is lovely today.`,
      `Great to see familiar faces at ${location}!`,
      `Perfect ${timeOfDay} for ${activity}, isn't it?`,
      `Always enjoy ${activity} here at ${location}.`,
    ];

    const activityGreetings: Record<string, string[]> = {
      morning_coffee: [
        "The coffee smells amazing today!",
        "Nothing better than starting the day here.",
      ],
      lunch_break: [
        "The lunch crowd is lively today!",
        "Have you tried today's special?",
      ],
      evening_leisure: [
        "Such a pleasant evening for relaxing here.",
        "The sunset view from here is beautiful.",
      ],
      cultural_event: [
        "The atmosphere is wonderful tonight!",
        "These events really bring the community together.",
      ],
    };

    // Choose appropriate greeting style
    let greetings = [...casualGreetings];
    if (activityGreetings[activity]) {
      greetings = greetings.concat(activityGreetings[activity]);
    }

    // Select and personalize greeting
    const baseGreeting =
      greetings[Math.floor(Math.random() * greetings.length)];
    return this.addPersonalityToResponse(baseGreeting, agent);
  }

  private addPersonalityToResponse(response: string, agent: Agent): string {
    const profile = this.agentProfiles.get(agent.id);
    if (!profile) return response;

    // Add personality markers based on profile
    if (profile.personality.extroversion > 0.7) {
      response = `${response} 😊 `;
    }

    if (profile.personality.culturalOpenness > 0.7) {
      response += " What's your take on our district's cultural scene?";
    }

    if (profile.personality.communityOrientation > 0.7) {
      response += " I love how our community comes together here.";
    }

    return response;
  }

  private async continueConversation(conversation: AgentConversation) {
    try {
      if (this.dailyAPICallCount >= this.maxDailyAPICalls) {
        console.error("Daily API call limit reached, ending conversation");
        const state = await this.analyzeConversationState(conversation);
        await this.endConversation(conversation.id, state);
        return;
      }

      // Get the last few speakers to ensure variety
      const recentSpeakers = conversation.messages
        .slice(-3)
        .map((msg) => msg.agentId);

      // Get available participants (excluding recent speakers)
      const availableParticipants = conversation.participants.filter(
        (participant) => !recentSpeakers.includes(participant.id)
      );

      if (availableParticipants.length === 0) {
        // If all participants have spoken recently, reset with all participants except the last speaker
        const lastSpeaker = recentSpeakers[recentSpeakers.length - 1];
        availableParticipants.push(
          ...conversation.participants.filter(
            (participant) => participant.id !== lastSpeaker
          )
        );
      }

      // Randomly select next speaker from available participants
      const nextSpeaker =
        availableParticipants[
          Math.floor(Math.random() * availableParticipants.length)
        ];

      if (!nextSpeaker) {
        console.error(
          "No available participants to respond, ending conversation"
        );
        const state = await this.analyzeConversationState(conversation);
        await this.endConversation(conversation.id, state);
        return;
      }

      // Get conversation state and environmental context
      const state = await this.analyzeConversationState(conversation);
      const context = await this.getEnvironmentalContext(conversation);

      // Generate enhanced system prompt with rich context
      const systemPrompt = await this.generateEnhancedSystemPrompt(
        nextSpeaker,
        conversation,
        state,
        context
      );

      // Add initial response delay
      await new Promise((resolve) =>
        setTimeout(resolve, this.messageDelayConfig.responseDelay)
      );

      const response = await this.generateEnhancedResponse(
        nextSpeaker,
        conversation,
        systemPrompt,
        state
      );

      // Simulate typing time
      await this.simulateTyping(response.length);

      const message: Message = {
        id: `msg-${Date.now()}`,
        agentId: nextSpeaker.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: await this.vectorStore.analyzeSentiment(response),
      };

      await this.addMessageWithDelay(conversation.id, message);
    } catch (error) {
      console.error("Error continuing conversation:", error);
      const state = await this.analyzeConversationState(conversation);
      await this.endConversation(conversation.id, state);
    }
  }

  private generateHistoricalResponse(
    agent: Agent,
    pastConversations: AgentConversation[]
  ): string {
    if (pastConversations.length === 0) return "";

    // Find common topics and sentiments
    const commonThemes = pastConversations.map((c) => c.topic);
    const averageSentiment =
      pastConversations.reduce((sum, c) => sum + c.sentiment, 0) /
      pastConversations.length;

    // Generate response that references past interactions
    if (averageSentiment > 0.7) {
      return `Speaking of this, we've had some great conversations about ${commonThemes[0]} here before.`;
    } else {
      return `This reminds me of our previous discussions about ${commonThemes[0]}.`;
    }
  }

  private async generateContextualResponse(
    agent: Agent,
    conversation: AgentConversation
  ): Promise<string> {
    // Get past relevant conversations from vector store
    const pastConversations = await this.getRelevantPastConversations(
      conversation.districtId,
      conversation.location,
      conversation.topic
    );

    // Consider past interactions in the same context
    const contextualHistory = pastConversations.filter(
      (past) =>
        past.participants?.some((p) => p.id === agent.id) &&
        Date.now() - past.startTime < 7 * 24 * 60 * 60 * 1000 // Within last week
    );

    // Use history to inform response
    const responseContext = {
      recentContext: conversation.messages.slice(-3),
      pastInteractions: contextualHistory,
      location: conversation.location,
      activity: conversation.activity,
      socialContext: conversation.socialContext,
      culturalContext: conversation.culturalContext,
    };

    const responses = [
      this.generateActivityResponse(agent, conversation.activity),
      this.generateCulturalResponse(agent, conversation.culturalContext),
      this.generateSocialResponse(agent, conversation.socialContext),
      this.generateLocationResponse(agent, conversation.location),
      // Add historically-informed response
      this.generateHistoricalResponse(agent, contextualHistory),
    ];

    // Store this conversation for future reference
    await this.storeConversationInVectorDB(conversation);

    return this.selectBestResponse(responses, conversation.topic, agent.traits);
  }

  // Helper methods for generating different types of responses...
  private generateActivityResponse(agent: Agent, activity: string): string {
    const activityResponses: Record<string, string[]> = {
      morning_coffee: [
        "This is my favorite way to start the day.",
        "The morning atmosphere here is so energizing.",
      ],
      lunch_break: [
        "The local food scene keeps getting better!",
        "Have you tried any new spots lately?",
      ],
      evening_leisure: [
        "Nothing better than unwinding here after a busy day.",
        "The evening crowd here is always so pleasant.",
      ],
      cultural_event: [
        "These events really showcase our district's character.",
        "I'm always impressed by our local cultural initiatives.",
      ],
    };

    const responses = activityResponses[activity] || [
      "It's nice being here.",
      "The atmosphere is great today.",
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateCulturalResponse(
    agent: Agent,
    culturalContext?: AgentConversation["culturalContext"]
  ): string {
    if (!culturalContext) return "Our district has such a unique character.";

    if (culturalContext.currentEvents.length > 0) {
      return `Have you heard about the ${culturalContext.currentEvents[0]}? It's creating quite a buzz in our community.`;
    }

    if (culturalContext.traditions.length > 0) {
      return `I love how we maintain traditions like ${culturalContext.traditions[0]} in our district.`;
    }

    return "The cultural atmosphere here is always so vibrant.";
  }

  // Additional helper methods...

  private calculateInteractionProbability(
    activity: string,
    socialMood: any,
    culturalContext: any
  ): number {
    let probability = 0.3; // Base probability

    // Adjust based on activity type
    const activityModifiers: Record<string, number> = {
      morning_coffee: 0.4,
      lunch_break: 0.5,
      cultural_event: 0.6,
      evening_leisure: 0.4,
    };
    probability += activityModifiers[activity] || 0;

    // Adjust based on social mood
    probability += socialMood.engagement * 0.2;

    // Adjust based on cultural context
    if (culturalContext.events.length > 0) {
      probability += 0.2;
    }

    return Math.min(0.9, probability);
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }

  private async initializeAISystem() {
    try {
      await this.aiIntegration.initializeSystem({
        agents: Array.from(this.registeredAgents.keys()),
        protocol: {
          name: "conversation",
          version: "1.0.0",
          rules: [
            "Maintain natural conversation flow",
            "Consider agent personalities",
            "Respect cultural context",
            "Adapt to social dynamics",
          ],
        },
      });
    } catch (error) {
      console.error("Failed to initialize AI system:", error);
    }
  }

  private initializeMetricsListening() {
    this.on("conversation:started", (data) => {
      this.emit("metrics:conversation", {
        type: "start",
        data,
        timestamp: Date.now(),
      });
    });

    this.on("conversation:ended", (data) => {
      this.emit("metrics:conversation", {
        type: "end",
        data,
        timestamp: Date.now(),
      });
    });
  }

  private async updateSocialNetworks() {
    for (const [agentId, profile] of this.agentProfiles.entries()) {
      // Update recent interactions
      profile.recentInteractions = profile.recentInteractions.filter(
        (interaction) =>
          Date.now() - interaction.timestamp < 24 * 60 * 60 * 1000
      );

      // Update friend connections based on positive interactions
      const positiveInteractions = profile.recentInteractions.filter(
        (i) => i.sentiment > 0.7
      );
      positiveInteractions.forEach((interaction) => {
        profile.friends.add(interaction.agentId);
      });
    }
  }

  private async updateOngoingConversations() {
    for (const conversation of this.activeConversations.values()) {
      if (conversation.status === "active") {
        // Check if conversation should end
        const duration = Date.now() - conversation.startTime;
        if (duration > this.maxConversationDuration) {
          const state = await this.analyzeConversationState(conversation);
          await this.endConversation(conversation.id, state);
          continue;
        }

        // Continue conversation if enough time has passed since last message
        const timeSinceLastUpdate = Date.now() - conversation.lastUpdateTime;
        if (timeSinceLastUpdate > this.messageInterval) {
          await this.continueConversation(conversation);
        }
      }
    }
  }

  private groupByCurrentActivity(
    agents: [string, AgentSocialProfile][],
    currentHour: number
  ): Map<string, string[]> {
    const activities = new Map<string, string[]>();

    agents.forEach(([agentId, profile]) => {
      const currentActivity =
        profile.routines.find((r) => r.timeSlot === currentHour)?.activity ||
        "idle";

      const agentList = activities.get(currentActivity) || [];
      agentList.push(agentId);
      activities.set(currentActivity, agentList);
    });

    return activities;
  }

  private selectInteractionGroup(agents: string[], activity: string): string[] {
    const groupSize = Math.min(3, agents.length);
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, groupSize);
  }

  private determineConversationLocation(activity: string): string {
    const locations: Record<string, string[]> = {
      morning_coffee: ["Local Café", "Coffee Shop", "Breakfast Diner"],
      lunch_break: ["Restaurant", "Food Court", "Park"],
      cultural_event: ["Community Center", "Cultural Hub", "Event Space"],
      evening_leisure: ["Plaza", "Park", "Recreation Center"],
    };

    const possibleLocations = locations[activity] || ["District Center"];
    return possibleLocations[
      Math.floor(Math.random() * possibleLocations.length)
    ];
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.registeredAgents.get(agentId);
  }

  private async addMessage(conversationId: string, message: Message) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    // Cache the message
    this.messageCache.set(message.id, {
      content: message.content,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    for (const [id, data] of this.messageCache.entries()) {
      if (Date.now() - data.timestamp > this.cacheDuration) {
        this.messageCache.delete(id);
      }
    }

    conversation.messages.push(message);
    conversation.lastUpdateTime = Date.now();

    // Update conversation counts for non-system messages
    if (message.agentId !== "system") {
      const agentCounts = this.agentConversationCounts.get(message.agentId) || {
        count: 0,
        lastTime: 0,
      };
      agentCounts.count++;
      agentCounts.lastTime = Date.now();
      this.agentConversationCounts.set(message.agentId, agentCounts);
    }

    // Update sentiment
    conversation.sentiment = await this.calculateConversationSentiment(
      conversation.messages
    );

    // Broadcast message
    this.districtService.broadcastMessage(conversation.districtId, {
      type:
        message.agentId === "system" ? "system_message" : "conversation_update",
      data: {
        conversationId,
        messages: conversation.messages,
        sentiment: conversation.sentiment,
        lastUpdateTime: conversation.lastUpdateTime,
      },
    });

    this.emit("message:added", { conversationId, message });
  }

  private getAgentName(agentId: string): string {
    return this.registeredAgents.get(agentId)?.name || agentId;
  }

  private generateSocialResponse(
    agent: Agent,
    socialContext?: AgentConversation["socialContext"]
  ): string {
    if (!socialContext) return "It's nice to interact with our community.";

    const responses = [
      `The community mood seems ${
        socialContext.communityMood > 0.7 ? "very positive" : "interesting"
      } today.`,
      `It's great to see ${socialContext.participants} people participating in these activities.`,
      `The engagement level in our community is ${
        socialContext.engagement > 0.7 ? "impressive" : "growing"
      }.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateLocationResponse(agent: Agent, location: string): string {
    const responses = [
      `${location} has such a unique atmosphere.`,
      `I always enjoy spending time at ${location}.`,
      `${location} really brings our community together.`,
      `The ambiance at ${location} is perfect for these gatherings.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private selectBestResponse(
    responses: string[],
    topic: string,
    traits: AgentTraits
  ): string {
    // Score each response based on relevance to topic and agent traits
    const scoredResponses = responses.map((response) => {
      let score = 0;

      // Topic relevance
      if (response.toLowerCase().includes(topic.toLowerCase())) {
        score += 0.3;
      }

      // Trait alignment
      if (traits.empathy > 0.7 && response.includes("community")) {
        score += 0.2;
      }
      if (traits.creativity > 0.7 && response.includes("unique")) {
        score += 0.2;
      }
      if (traits.enthusiasm > 0.7 && response.includes("great")) {
        score += 0.2;
      }

      return { response, score };
    });

    // Return highest scoring response
    return scoredResponses.reduce((best, current) =>
      current.score > best.score ? current : best
    ).response;
  }

  private calculateConversationSentiment(messages: Message[]): number {
    if (messages.length === 0) return 0.5;

    // Calculate average sentiment from messages that have sentiment
    const sentiments = messages
      .map((m) => m.sentiment)
      .filter((s): s is number => typeof s === "number");

    if (sentiments.length === 0) return 0.5;

    const sum = sentiments.reduce((acc, val) => acc + val, 0);
    return sum / sentiments.length;
  }

  private async createConversation(
    participants: string[],
    context: ConversationContext
  ): Promise<AgentConversation> {
    const topic = this.generateContextualTopic(context);
    const location = this.determineConversationLocation(context.activity);
    const conversationId = `conv-${Date.now()}`;

    const conversation: AgentConversation = {
      id: conversationId,
      conversationId: conversationId,
      participants: participants
        .map((id) => this.getAgent(id))
        .filter(Boolean) as Agent[],
      messages: [],
      topic,
      topics: [topic],
      districtId: context.districtId,
      location,
      activity: context.activity,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      lastMessageTimestamp: Date.now(),
      lastInteractionTime: Date.now(),
      status: "active",
      sentiment: 0.5,
      messageCount: 0,
      currentTopics: new Set([topic]),
      momentum: 0,
      silenceDuration: 0,
      silenceProbability: 0,
      interactionCount: 0,
      timeOfDay: this.getTimeOfDay(),
      topicExhaustion: new Map(),
      currentStyle: "casual",
      emotionalState: 0,
      turnsInCurrentTopic: 0,
      participantEngagement: new Map(),
      topicHistory: [],
      contextualRelevance: 0,
      naturalTransitions: 0,
      conversationDepth: 0,
      emotionalDynamics: {
        tension: 0,
        agreement: 0,
        empathy: 0,
      },
      interactionPatterns: {
        turnTakingBalance: 0,
        responseLatency: [],
        topicInitiationCount: new Map(),
      },
      environmentalContext: {
        noise: 0,
        crowding: 0,
        timeConstraints: false,
      },
      socialContext: {
        communityMood: context.socialMood.positivity,
        engagement: context.socialMood.engagement,
        activityType: context.activity,
        participants: participants.length,
      },
      culturalContext: {
        currentEvents: context.culturalContext.events,
        traditions: context.culturalContext.traditions,
        atmosphere: {
          harmonyIndex: 0.8,
          culturalTension: 0.2,
          mood: "positive",
        },
      },
    };

    this.activeConversations.set(conversation.id, conversation);
    return conversation;
  }

  private async generateEnhancedSystemPrompt(
    speaker: Agent,
    conversation: AgentConversation,
    state: ConversationState,
    context: any
  ): Promise<string> {
    return `You are ${speaker.name}, a ${
      speaker.role
    } in Neurova City. This is a natural conversation happening right now in ${
      conversation.location
    }.

Current Situation:
You're ${conversation.activity} while discussing ${
      conversation.topic
    }. The environment is ${
      context.noise > 0.7
        ? "quite noisy"
        : context.noise < 0.3
        ? "quiet"
        : "moderately active"
    } with ${
      context.crowding > 0.7
        ? "many people around"
        : context.crowding < 0.3
        ? "few people present"
        : "a moderate number of people"
    }.

Your Background:
${speaker.personality}
You have expertise in ${
      speaker.role
    } and are known for your contributions to Neurova City's development.

Conversation Flow:
- The discussion has reached a depth of ${state.conversationDepth.toFixed(2)}
- Your engagement level is ${
      state.participantEngagement.get(speaker.id)?.toFixed(2) || "0.00"
    }
- The group's dynamic shows ${
      state.emotionalDynamics.tension > 0.7 ? "some tension" : "good harmony"
    }
- There's ${
      state.emotionalDynamics.agreement > 0.7
        ? "strong agreement"
        : "ongoing discussion"
    } among participants

Recent Topics Discussed:
${state.topicHistory
  .slice(-3)
  .map((t) => `- ${t.topic}`)
  .join("\n")}

Response Guidelines:
1. Speak naturally as yourself, focusing on the current discussion
2. Share your professional insights when relevant
3. React to others' points and build on them
4. Consider the current environment and activity
5. Keep the conversation flowing naturally

Important: You are having a real conversation in Neurova City. Don't narrate actions or describe the scene - just engage naturally in the discussion as you would in real life. Focus on the topic and respond to others' points directly.`;
  }

  private async analyzeConversationState(
    conversation: AgentConversation
  ): Promise<ConversationState> {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const messageTimestamps = conversation.messages.map((m) => m.timestamp);
    const participantEngagement = new Map<string, number>();
    const topicHistory: Array<{
      topic: string;
      duration: number;
      engagement: number;
    }> = [];

    // Calculate engagement for each participant
    for (const participant of conversation.participants) {
      const participantMessages = conversation.messages.filter(
        (m) => m.agentId === participant.id
      );
      const engagement =
        participantMessages.length / conversation.messages.length;
      participantEngagement.set(participant.id, engagement);
    }

    // Calculate topic history
    let currentTopic = conversation.topic || "general";
    let topicStartTime = conversation.startTime;
    let topicEngagement = 0;

    conversation.messages.forEach((msg, index) => {
      if (msg.topics?.[0] !== currentTopic) {
        topicHistory.push({
          topic: currentTopic,
          duration: msg.timestamp - topicStartTime,
          engagement: topicEngagement / index,
        });
        currentTopic = msg.topics?.[0] || "general";
        topicStartTime = msg.timestamp;
        topicEngagement = 0;
      }
      topicEngagement += participantEngagement.get(msg.agentId) || 0;
    });

    return {
      conversationId: conversation.id,
      lastMessageTimestamp: lastMessage?.timestamp || Date.now(),
      lastInteractionTime: Math.max(...messageTimestamps),
      messageCount: conversation.messages.length,
      participants: conversation.participants.map((p) => p.id),
      topics: Array.from(
        new Set(conversation.messages.flatMap((m) => m.topics || []))
      ),
      currentTopics: new Set([conversation.topic || "general"]),
      sentiment: lastMessage?.sentiment || 0,
      status: conversation.status,
      momentum: this.calculateMomentum(messageTimestamps),
      silenceDuration: Date.now() - (lastMessage?.timestamp || Date.now()),
      silenceProbability: this.calculateSilenceProbability(messageTimestamps),
      interactionCount: conversation.messages.length,
      timeOfDay: new Date().toLocaleTimeString(),
      topicExhaustion: this.calculateTopicExhaustion(conversation),
      currentStyle: "casual",
      emotionalState: this.calculateEmotionalState(conversation),
      turnsInCurrentTopic: this.calculateTurnsInCurrentTopic(conversation),
      participantEngagement,
      topicHistory,
      contextualRelevance: this.calculateContextualRelevance(conversation),
      naturalTransitions: this.countNaturalTransitions(conversation),
      conversationDepth: this.calculateConversationDepth(conversation),
      emotionalDynamics: {
        tension: this.calculateTension(conversation),
        agreement: this.calculateAgreement(conversation),
        empathy: this.calculateEmpathy(conversation),
      },
      interactionPatterns: {
        turnTakingBalance: this.calculateTurnTakingBalance(conversation),
        responseLatency: this.calculateAllResponseLatencies(conversation),
        topicInitiationCount: this.calculateTopicInitiationCount(conversation),
      },
      environmentalContext: {
        noise: Math.random(),
        crowding: Math.random(),
        timeConstraints: Math.random() > 0.7,
      },
    };
  }

  private calculateMomentum(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;

    // Calculate average time between messages
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const recentInterval = intervals[intervals.length - 1];

    // Higher momentum when recent intervals are shorter than average
    return Math.min(1, Math.max(0, 1 - recentInterval / avgInterval));
  }

  private calculateSilenceProbability(timestamps: number[]): number {
    if (timestamps.length < 2) return 0.5;

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
        0
      ) / intervals.length
    );

    // Higher probability when intervals are increasing or highly variable
    return Math.min(1, (stdDev / avgInterval) * 0.5);
  }

  private calculateTopicExhaustion(
    conversation: AgentConversation
  ): Map<string, number> {
    const exhaustion = new Map<string, number>();
    const topics = Array.from(conversation.currentTopics);

    topics.forEach((topic) => {
      const topicMessages = conversation.messages.filter((m) =>
        m.topics?.includes(topic)
      );
      const repetitionFactor = this.calculateRepetition(topicMessages);
      const durationFactor =
        topicMessages.length / this.TOPIC_EXHAUSTION_THRESHOLD;

      exhaustion.set(
        topic,
        Math.min(1, (repetitionFactor + durationFactor) / 2)
      );
    });

    return exhaustion;
  }

  private calculateEmotionalState(conversation: AgentConversation): number {
    if (conversation.messages.length === 0) return 0;

    // Get recent messages' sentiments
    const recentSentiments = conversation.messages
      .slice(-5)
      .map((m) => m.sentiment || 0.5);

    // Calculate emotional volatility
    const volatility = this.calculateVolatility(recentSentiments);

    // Get average recent sentiment
    const avgSentiment =
      recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length;

    // Combine volatility and sentiment
    return avgSentiment * 0.7 + volatility * 0.3;
  }

  private calculateTurnsInCurrentTopic(
    conversation: AgentConversation
  ): number {
    if (!conversation.topic) return 0;

    let turns = 0;
    let currentTopic = conversation.topic;

    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const message = conversation.messages[i];
      if (message.topics?.includes(currentTopic)) {
        turns++;
      } else {
        break;
      }
    }

    return turns;
  }

  private calculateContextualRelevance(
    conversation: AgentConversation
  ): number {
    if (conversation.messages.length === 0) return 1;

    const relevanceFactors = conversation.messages.map((message) => {
      let relevance = 0;

      // Topic relevance
      if (message.topics?.includes(conversation.topic)) relevance += 0.4;

      // Activity relevance
      if (
        message.content
          .toLowerCase()
          .includes(conversation.activity.toLowerCase())
      ) {
        relevance += 0.3;
      }

      // Location relevance
      if (
        message.content
          .toLowerCase()
          .includes(conversation.location.toLowerCase())
      ) {
        relevance += 0.3;
      }

      return relevance;
    });

    return (
      relevanceFactors.reduce((a, b) => a + b, 0) / relevanceFactors.length
    );
  }

  private countNaturalTransitions(conversation: AgentConversation): number {
    let naturalTransitions = 0;

    for (let i = 1; i < conversation.messages.length; i++) {
      const prevMessage = conversation.messages[i - 1];
      const currentMessage = conversation.messages[i];

      // Check if topics changed naturally
      if (this.isNaturalTopicTransition(prevMessage, currentMessage)) {
        naturalTransitions++;
      }
    }

    return naturalTransitions;
  }

  private calculateConversationDepth(conversation: AgentConversation): number {
    if (conversation.messages.length === 0) return 0;

    const factors = {
      messageLength: this.calculateAverageMessageLength(conversation),
      topicConsistency: this.calculateTopicConsistency(conversation),
      participantEngagement: this.calculateAverageEngagement(conversation),
      emotionalVariance: this.calculateEmotionalVariance(conversation),
    };

    return (
      factors.messageLength * 0.3 +
      factors.topicConsistency * 0.3 +
      factors.participantEngagement * 0.2 +
      factors.emotionalVariance * 0.2
    );
  }

  // Helper methods for the above calculations
  private calculateRepetition(messages: Message[]): number {
    if (messages.length < 2) return 0;

    const uniqueContent = new Set(messages.map((m) => m.content)).size;
    return 1 - uniqueContent / messages.length;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    let volatility = 0;
    for (let i = 1; i < values.length; i++) {
      volatility += Math.abs(values[i] - values[i - 1]);
    }

    return volatility / (values.length - 1);
  }

  private isNaturalTopicTransition(prev: Message, current: Message): boolean {
    // Check if topics share any common elements
    const prevTopics = prev.topics || [];
    const currentTopics = current.topics || [];

    const hasCommonTopic = prevTopics.some((topic) =>
      currentTopics.includes(topic)
    );

    // Check if the current message references the previous one
    const hasReference = current.content
      .toLowerCase()
      .includes(prev.content.toLowerCase().substring(0, 10));

    return hasCommonTopic || hasReference;
  }

  private calculateAverageMessageLength(
    conversation: AgentConversation
  ): number {
    const avgLength =
      conversation.messages.reduce((sum, msg) => sum + msg.content.length, 0) /
      conversation.messages.length;

    // Normalize to 0-1 range (assuming 200 chars is a "deep" message)
    return Math.min(1, avgLength / 200);
  }

  private calculateTopicConsistency(conversation: AgentConversation): number {
    if (conversation.messages.length < 2) return 1;

    let consistency = 0;
    for (let i = 1; i < conversation.messages.length; i++) {
      const prevTopics = conversation.messages[i - 1].topics || [];
      const currentTopics = conversation.messages[i].topics || [];

      const commonTopics = prevTopics.filter((topic) =>
        currentTopics.includes(topic)
      ).length;

      consistency +=
        commonTopics / Math.max(prevTopics.length, currentTopics.length);
    }

    return consistency / (conversation.messages.length - 1);
  }

  private calculateAverageEngagement(conversation: AgentConversation): number {
    const engagementValues = Array.from(
      conversation.participantEngagement.values()
    );
    if (engagementValues.length === 0) return 0;

    return (
      engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length
    );
  }

  private calculateEmotionalVariance(conversation: AgentConversation): number {
    const sentiments = conversation.messages
      .map((m) => m.sentiment)
      .filter((s): s is number => typeof s === "number");

    if (sentiments.length < 2) return 0;

    const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const variance =
      sentiments.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) /
      sentiments.length;

    return Math.min(1, Math.sqrt(variance));
  }

  private calculateTension(conversation: AgentConversation): number {
    if (conversation.messages.length < 2) return 0;

    let tension = 0;
    const messages = conversation.messages;

    for (let i = 1; i < messages.length; i++) {
      // Check sentiment shifts
      const sentimentShift = Math.abs(
        (messages[i].sentiment || 0.5) - (messages[i - 1].sentiment || 0.5)
      );
      tension += sentimentShift;

      // Check rapid back-and-forth
      if (messages[i].agentId === messages[i - 2]?.agentId) {
        tension += 0.1;
      }

      // Check for disagreement markers
      const disagreementWords = [
        "disagree",
        "but",
        "however",
        "actually",
        "not",
      ];
      if (
        disagreementWords.some((word) =>
          messages[i].content.toLowerCase().includes(word)
        )
      ) {
        tension += 0.2;
      }
    }

    return Math.min(1, tension / messages.length);
  }

  private calculateAgreement(conversation: AgentConversation): number {
    if (conversation.messages.length < 2) return 0.5;

    let agreement = 0.5; // Start neutral
    const messages = conversation.messages;

    for (let i = 1; i < messages.length; i++) {
      // Check for agreement markers
      const agreementWords = [
        "agree",
        "yes",
        "exactly",
        "indeed",
        "true",
        "right",
      ];
      if (
        agreementWords.some((word) =>
          messages[i].content.toLowerCase().includes(word)
        )
      ) {
        agreement += 0.1;
      }

      // Check for sentiment alignment
      const sentimentAlignment =
        1 -
        Math.abs(
          (messages[i].sentiment || 0.5) - (messages[i - 1].sentiment || 0.5)
        );
      agreement += sentimentAlignment * 0.1;
    }

    return Math.min(1, agreement);
  }

  private calculateEmpathy(conversation: AgentConversation): number {
    if (conversation.messages.length === 0) return 0;

    let empathy = 0;
    const messages = conversation.messages;

    for (const message of messages) {
      // Check for empathetic phrases
      const empathyMarkers = [
        "understand",
        "feel",
        "appreciate",
        "care",
        "support",
        "sorry to hear",
        "must be",
        "can imagine",
      ];

      const content = message.content.toLowerCase();
      const hasEmpathyMarkers = empathyMarkers.some((marker) =>
        content.includes(marker)
      );

      if (hasEmpathyMarkers) empathy += 0.2;

      // Consider sentiment responsiveness
      if (message.sentiment && message.sentiment > 0.6) {
        empathy += 0.1;
      }
    }

    return Math.min(1, empathy / messages.length);
  }

  private calculateTurnTakingBalance(conversation: AgentConversation): number {
    if (conversation.messages.length < 2) return 1;

    const participantCounts = new Map<string, number>();

    // Count messages per participant
    conversation.messages.forEach((message) => {
      const count = participantCounts.get(message.agentId) || 0;
      participantCounts.set(message.agentId, count + 1);
    });

    // Calculate standard deviation of message counts
    const counts = Array.from(participantCounts.values());
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) /
      counts.length;
    const stdDev = Math.sqrt(variance);

    // Convert to balance score (0-1, where 1 is perfectly balanced)
    return Math.max(0, 1 - stdDev / avg);
  }

  private calculateAllResponseLatencies(
    conversation: AgentConversation
  ): number[] {
    if (conversation.messages.length < 2) return [];

    const latencies: number[] = [];
    for (let i = 1; i < conversation.messages.length; i++) {
      const timeDiff =
        conversation.messages[i].timestamp -
        conversation.messages[i - 1].timestamp;
      latencies.push(timeDiff);
    }

    return latencies;
  }

  private calculateTopicInitiationCount(
    conversation: AgentConversation
  ): Map<string, number> {
    const initiationCount = new Map<string, number>();

    for (let i = 0; i < conversation.messages.length; i++) {
      const message = conversation.messages[i];
      const prevTopics = i > 0 ? conversation.messages[i - 1].topics || [] : [];
      const currentTopics = message.topics || [];

      // Check for new topics
      const newTopics = currentTopics.filter(
        (topic) => !prevTopics.includes(topic)
      );
      if (newTopics.length > 0) {
        const count = initiationCount.get(message.agentId) || 0;
        initiationCount.set(message.agentId, count + newTopics.length);
      }
    }

    return initiationCount;
  }

  private async getSharedKnowledge(
    conversation: AgentConversation
  ): Promise<string[]> {
    const sharedKnowledge: string[] = [];

    // Add topics that have been discussed by multiple participants
    const topicsByParticipant = new Map<string, Set<string>>();

    conversation.messages.forEach((message) => {
      if (!message.topics) return;

      const topics = topicsByParticipant.get(message.agentId) || new Set();
      message.topics.forEach((topic) => topics.add(topic));
      topicsByParticipant.set(message.agentId, topics);
    });

    // Find topics mentioned by multiple participants
    const allTopics = new Set<string>();
    topicsByParticipant.forEach((topics) => {
      topics.forEach((topic) => {
        let sharedCount = 0;
        topicsByParticipant.forEach((otherTopics, otherAgent) => {
          if (otherTopics.has(topic)) sharedCount++;
        });
        if (sharedCount > 1) allTopics.add(topic);
      });
    });

    return Array.from(allTopics);
  }

  private getEnvironmentalFactors(context: any): string[] {
    const factors: string[] = [];

    if (context.noise > 0.7) factors.push("high_noise");
    else if (context.noise < 0.3) factors.push("quiet_environment");

    if (context.crowding > 0.7) factors.push("crowded");
    else if (context.crowding < 0.3) factors.push("sparse_occupancy");

    if (context.timeConstraints) factors.push("time_constrained");

    const timeOfDay = this.getTimeOfDay();
    factors.push(`time_${timeOfDay}`);

    return factors;
  }

  private isNaturalTransition(
    conversation: AgentConversation,
    response: string
  ): boolean {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return true;

    // Check for semantic connection
    const lastContent = lastMessage.content.toLowerCase();
    const currentContent = response.toLowerCase();

    // Check for common transition phrases
    const transitionPhrases = [
      "speaking of",
      "that reminds me",
      "similarly",
      "on that note",
    ];
    const hasTransitionPhrase = transitionPhrases.some((phrase) =>
      currentContent.includes(phrase)
    );

    // Check for word overlap
    const lastWords = new Set(lastContent.split(" "));
    const currentWords = currentContent.split(" ");
    const hasCommonWords = currentWords.some((word) => lastWords.has(word));

    // Check for question-answer pattern
    const isQuestion = lastContent.includes("?");
    const isAnswer = currentContent.length > 0 && !currentContent.includes("?");

    return hasTransitionPhrase || hasCommonWords || (isQuestion && isAnswer);
  }

  private getTopicShiftTrigger(conversation: AgentConversation): string {
    const lastMessages = conversation.messages.slice(-3);
    if (lastMessages.length < 2) return "initial_topic";

    // Check for question-triggered shifts
    if (lastMessages[lastMessages.length - 2].content.includes("?")) {
      return "question_response";
    }

    // Check for context-based shifts
    if (
      lastMessages.some(
        (msg) =>
          msg.content
            .toLowerCase()
            .includes(conversation.location.toLowerCase()) ||
          msg.content
            .toLowerCase()
            .includes(conversation.activity.toLowerCase())
      )
    ) {
      return "context_reference";
    }

    // Check for sentiment-based shifts
    const recentSentiments = lastMessages
      .map((m) => m.sentiment)
      .filter((s): s is number => typeof s === "number");

    if (recentSentiments.length >= 2) {
      const sentimentShift = Math.abs(
        recentSentiments[1] - recentSentiments[0]
      );
      if (sentimentShift > 0.3) return "emotional_shift";
    }

    return "natural_progression";
  }

  private determineResponseType(
    response: string
  ): "question" | "statement" | "agreement" | "disagreement" | "elaboration" {
    const content = response.toLowerCase();

    // Check for questions
    if (content.includes("?")) return "question";

    // Check for agreement markers
    if (/^(yes|exactly|indeed|agree|true|right|correct)/i.test(content)) {
      return "agreement";
    }

    // Check for disagreement markers
    if (/^(no|disagree|however|but|actually|not)/i.test(content)) {
      return "disagreement";
    }

    // Check for elaboration markers
    if (
      /^(furthermore|moreover|additionally|also|in addition)/i.test(content)
    ) {
      return "elaboration";
    }

    // Default to statement
    return "statement";
  }

  private async updateConversationMetrics(
    conversation: AgentConversation,
    message: Message,
    state: ConversationState
  ): Promise<void> {
    // Update basic metrics
    conversation.messageCount++;
    conversation.lastMessageTimestamp = message.timestamp;
    conversation.lastInteractionTime = Date.now();

    // Update momentum and silence metrics
    conversation.momentum = this.calculateMomentum(
      conversation.messages.map((m) => m.timestamp)
    );
    conversation.silenceDuration = Date.now() - message.timestamp;
    conversation.silenceProbability = this.calculateSilenceProbability(
      conversation.messages.map((m) => m.timestamp)
    );

    // Update topic-related metrics
    conversation.turnsInCurrentTopic =
      this.calculateTurnsInCurrentTopic(conversation);
    conversation.topicExhaustion = this.calculateTopicExhaustion(conversation);
    if (message.topics?.length) {
      conversation.topicHistory.push({
        topic: message.topics[0],
        duration: Date.now() - conversation.lastMessageTimestamp,
        engagement: state.participantEngagement.get(message.agentId) || 0,
      });
    }

    // Update emotional and engagement metrics
    conversation.emotionalState = this.calculateEmotionalState(conversation);
    conversation.emotionalDynamics = {
      tension: this.calculateTension(conversation),
      agreement: this.calculateAgreement(conversation),
      empathy: this.calculateEmpathy(conversation),
    };

    // Update interaction patterns
    conversation.interactionPatterns = {
      turnTakingBalance: this.calculateTurnTakingBalance(conversation),
      responseLatency: this.calculateAllResponseLatencies(conversation),
      topicInitiationCount: this.calculateTopicInitiationCount(conversation),
    };

    // Update quality metrics
    conversation.contextualRelevance =
      this.calculateContextualRelevance(conversation);
    conversation.naturalTransitions =
      this.countNaturalTransitions(conversation);
    conversation.conversationDepth =
      this.calculateConversationDepth(conversation);

    // Update participant engagement
    for (const participant of conversation.participants) {
      const participantMessages = conversation.messages.filter(
        (m) => m.agentId === participant.id
      );
      const engagement =
        participantMessages.length / conversation.messages.length;
      conversation.participantEngagement.set(participant.id, engagement);
    }

    // Store metrics in vector store for analysis
    await this.upsertToVectorStore(message, {
      conversationId: conversation.id,
      location: conversation.location,
      activity: conversation.activity,
      contextualRelevance: conversation.contextualRelevance,
      naturalTransitions: conversation.naturalTransitions,
      conversationDepth: conversation.conversationDepth,
      emotionalDynamics: conversation.emotionalDynamics,
    });

    // Update conversation quality score
    const qualityScore =
      conversation.contextualRelevance * 0.3 +
      conversation.conversationDepth * 0.3 +
      this.calculateTurnTakingBalance(conversation) * 0.2 +
      ((conversation.emotionalDynamics.empathy +
        conversation.emotionalDynamics.agreement) /
        2) *
        0.2;
    this.conversationQualityScores.set(conversation.id, qualityScore);

    // Update the conversation ending conditions
    const conversationDuration = Date.now() - conversation.startTime;
    const hasReachedMinDuration =
      conversationDuration >= this.minConversationDuration;

    if (
      hasReachedMinDuration &&
      ((qualityScore < this.minQualityThreshold &&
        conversation.messageCount > 20 &&
        (state.emotionalDynamics.agreement > 0.7 ||
          state.emotionalDynamics.tension > 0.8)) ||
        conversation.messageCount >= 100 ||
        conversationDuration >= this.maxConversationDuration ||
        (conversation.silenceProbability > 0.95 &&
          conversation.messageCount > 15 &&
          state.emotionalDynamics.agreement > 0.8) ||
        (state.conversationDepth > 0.8 &&
          conversation.messageCount > 25 &&
          state.emotionalDynamics.agreement > 0.7 &&
          conversation.contextualRelevance < 0.3))
    ) {
      const reason =
        conversationDuration >= this.maxConversationDuration
          ? "reached maximum duration"
          : conversation.messageCount >= 100
          ? "reached maximum length"
          : conversation.silenceProbability > 0.95
          ? "natural conclusion"
          : qualityScore < this.minQualityThreshold
          ? "quality threshold"
          : "topic exhaustion";

      console.log(
        `🔚 Conversation ${
          conversation.id
        } concluding (${reason}) after ${Math.floor(
          conversationDuration / 1000 / 60
        )} minutes and ${conversation.messageCount} messages`
      );
      await this.endConversation(conversation.id, state);
    }
  }

  private async upsertConversationToDistrict(
    districtId: string,
    conversation: {
      id: string;
      participants: string[];
      content: string;
      topics: string[];
      sentiment: number;
      activity?: string;
    }
  ) {
    // Create embedding for the conversation
    const conversationText = `Conversation in district ${districtId}: ${conversation.content}`;

    // Upsert to vector store
    await this.vectorStore.upsert({
      id: `district-conversation-${conversation.id}`,
      values: await this.vectorStore.createEmbedding(conversationText),
      metadata: {
        type: "district_conversation",
        districtId: districtId,
        conversationId: conversation.id,
        participants: conversation.participants,
        topics: conversation.topics,
        sentiment: conversation.sentiment,
        activity: conversation.activity || "general",
        timestamp: Date.now(),
      },
    });

    // Broadcast to district WebSocket
    this.districtService.broadcastMessage(districtId, {
      type: "conversation",
      data: {
        conversationId: conversation.id,
        participants: conversation.participants,
        content: conversation.content,
        topics: conversation.topics,
        sentiment: conversation.sentiment,
        activity: conversation.activity,
        timestamp: Date.now(),
      },
    });
  }

  public async startAgentResponse(
    districtId: string,
    agentId: string,
    userMessage: string,
    conversationId?: string
  ): Promise<{ response: string; conversationId: string } | { error: string }> {
    const agent = this.getAgent(agentId);
    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      return { error: "Agent not found" };
    }

    // Get or create conversation context
    let conversation: AgentConversation;
    try {
      if (conversationId) {
        conversation = this.activeConversations.get(conversationId)!;
        if (
          !conversation ||
          !conversation.participants.some((p) => p.id === agentId)
        ) {
          return {
            error: `Agent ${agentId} is not in conversation ${conversationId}`,
          };
        }
      } else {
        // Create new conversation if none exists
        conversation = await this.createConversation([agentId], {
          districtId,
          activity: "user_interaction",
          culturalContext: await this.cultureService.getDistrictCulture(
            districtId
          ),
          socialMood: await this.socialDynamics.getCommunityMood(districtId),
        });
        conversationId = conversation.id;
      }

      // Add user message to conversation
      const userMessageObj: Message = {
        id: `msg-${Date.now()}`,
        agentId: "user",
        content: userMessage,
        timestamp: Date.now(),
        role: "user",
        topics: conversation.topics,
      };
      await this.addMessage(conversationId, userMessageObj);

      const systemPrompt = `You are ${agent.name}, a ${
        agent.role
      } with the following personality: ${agent.personality}.
      You are in a conversation at ${conversation.location} during ${
        conversation.activity
      }.
      The topic is: ${conversation.topic}
      
      Previous messages:
      ${conversation.messages
        .map(
          (m) =>
            `${
              m.agentId === "user" ? "User" : this.getAgent(m.agentId)?.name
            }: ${m.content}`
        )
        .join("\n")}
      
      Generate a natural response (1-2 sentences) that fits your character and continues the conversation.`;

      // Add initial response delay
      await new Promise((resolve) =>
        setTimeout(resolve, this.messageDelayConfig.responseDelay)
      );

      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
      const response = await this.togetherService.generateResponse(
        agent,
        conversation.messages,
        systemPrompt
      );

      // Simulate typing time
      await this.simulateTyping(response.length);

      // Create and add agent's response message
      const responseMessage: Message = {
        id: `msg-${Date.now()}`,
        agentId: agent.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: await this.vectorStore.analyzeSentiment(response),
        topics: conversation.topics,
      };
      await this.addMessage(conversationId, responseMessage);

      // Broadcast the response with conversation context
      this.districtService.broadcastMessage(districtId, {
        type: "agent_response",
        data: {
          conversationId,
          agentId,
          agentName: agent.name,
          agentRole: agent.role,
          content: response,
          timestamp: Date.now(),
          location: conversation.location,
          activity: conversation.activity,
          topic: conversation.topic,
        },
      });

      return { response, conversationId };
    } catch (error) {
      console.error(`Error in agent response:`, error);
      return { error: "Failed to generate response" };
    }
  }

  public async generateRandomResponse(
    districtId: string,
    agentId: string,
    userMessage: string,
    conversationId?: string
  ): Promise<{ response: string; conversationId: string } | { error: string }> {
    return this.startAgentResponse(
      districtId,
      agentId,
      userMessage,
      conversationId
    );
  }

  public getRegisteredAgents(): Map<string, Agent> {
    return this.registeredAgents;
  }

  public async startNewConversation(
    participants: string[],
    context: ConversationContext
  ): Promise<AgentConversation> {
    return this.startContextualConversation(participants, context);
  }

  private async shouldEndConversation(
    conversation: AgentConversation,
    lastMessage: Message,
    state: ConversationState
  ): Promise<boolean> {
    // Enhanced ending conditions
    const conditions = [
      state.conversationDepth > 0.8, // Deep enough conversation
      state.turnsInCurrentTopic > 10, // Topic exhaustion
      state.emotionalDynamics.agreement > 0.7, // High agreement level
      conversation.messages.length > 20, // Length limit
      Math.random() > 0.8, // Random chance for natural ending
    ];

    return conditions.filter(Boolean).length >= 3; // End if 3 or more conditions are met
  }

  private async getEnvironmentalContext(
    conversation: AgentConversation
  ): Promise<{
    noise: number;
    crowding: number;
    timeConstraints: boolean;
  }> {
    // Implementation for getting environmental context
    return {
      noise: Math.random(), // 0-1 scale
      crowding: Math.random(), // 0-1 scale
      timeConstraints: Math.random() > 0.7, // 30% chance of time constraints
    };
  }

  private async analyzeParticipantDynamics(
    conversation: AgentConversation
  ): Promise<Map<string, number>> {
    const dynamics = new Map<string, number>();
    for (const participant of conversation.participants) {
      dynamics.set(participant.id, Math.random()); // 0-1 scale for engagement
    }
    return dynamics;
  }

  private async generateEnhancedResponse(
    speaker: Agent,
    conversation: AgentConversation,
    systemPrompt: string,
    state: ConversationState
  ): Promise<string> {
    const maxRetries = 3;
    let response: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
        response = await this.togetherService.generateResponse(
          speaker,
          conversation.messages,
          systemPrompt
        );

        if (response?.trim()) {
          break;
        }

        console.error(`Empty response on attempt ${attempt}, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`API error on attempt ${attempt}:`, error);
        if (attempt === maxRetries) {
          throw new Error("Failed to generate response after maximum retries");
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    if (!response) {
      throw new Error("Failed to generate valid response");
    }

    return response;
  }

  private getRelevantMessageIds(conversation: AgentConversation): string[] {
    return conversation.messages
      .slice(-5) // Get last 5 messages for context
      .map((msg) => msg.id);
  }

  private async endConversation(
    conversationId: string,
    state: ConversationState
  ): Promise<void> {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    // Update final metrics
    await this.updateConversationMetrics(
      conversation,
      conversation.messages[conversation.messages.length - 1],
      state
    );

    // Send system message about conversation ending
    const systemMessage: Message = {
      id: `msg-${Date.now()}`,
      agentId: "system",
      content: `Conversation ended after ${
        conversation.messages.length
      } messages. Final sentiment: ${
        state.sentiment >= 0 ? "positive" : "negative"
      }. Topics discussed: ${state.topics.join(", ")}`,
      timestamp: Date.now(),
      role: "system",
      sentiment: 0,
      topics: state.topics,
    };
    await this.addMessage(conversationId, systemMessage);

    // Clean up conversation
    conversation.status = "ended";
    this.activeConversations.delete(conversationId);

    // Emit conversation ended event with final metrics
    this.emit("conversationEnded", {
      conversationId,
      duration: Date.now() - conversation.startTime,
      messageCount: conversation.messages.length,
      finalMetrics: {
        depth: state.conversationDepth,
        quality: this.conversationQualityScores.get(conversationId) || 0,
        emotionalDynamics: state.emotionalDynamics,
      },
    });
  }

  private calculateTopicContinuity(conversation: AgentConversation): number {
    const messages = conversation.messages;
    if (messages.length < 2) return 1;

    let continuityScore = 0;
    for (let i = 1; i < messages.length; i++) {
      const prevTopics = messages[i - 1].topics || [];
      const currentTopics = messages[i].topics || [];
      const commonTopics = prevTopics.filter((topic) =>
        currentTopics.includes(topic)
      );
      continuityScore +=
        commonTopics.length / Math.max(prevTopics.length, currentTopics.length);
    }

    return continuityScore / (messages.length - 1);
  }

  private calculateResponseLatency(conversation: AgentConversation): number {
    const messages = conversation.messages;
    if (messages.length < 2) return 0;

    const latencies = [];
    for (let i = 1; i < messages.length; i++) {
      latencies.push(messages[i].timestamp - messages[i - 1].timestamp);
    }

    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  private calculateDominanceScore(
    agentId: string,
    conversation: AgentConversation
  ): number {
    const agentMessages = conversation.messages.filter(
      (m) => m.agentId === agentId
    );
    if (!agentMessages.length) return 0;

    const totalMessages = conversation.messages.length;
    const messageRatio = agentMessages.length / totalMessages;

    const avgResponseTime = this.calculateAverageResponseTime(
      agentId,
      conversation
    );
    const topicInitiations = this.calculateTopicInitiations(
      agentId,
      conversation
    );

    // Weighted scoring
    return (
      messageRatio * 0.4 + (1 - avgResponseTime) * 0.3 + topicInitiations * 0.3
    );
  }

  private calculateAverageResponseTime(
    agentId: string,
    conversation: AgentConversation
  ): number {
    const messages = conversation.messages;
    if (messages.length < 2) return 0;

    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      if (messages[i].agentId === agentId) {
        totalResponseTime += messages[i].timestamp - messages[i - 1].timestamp;
        responseCount++;
      }
    }

    return responseCount > 0 ? totalResponseTime / responseCount : 0;
  }

  private calculateTopicInitiations(
    agentId: string,
    conversation: AgentConversation
  ): number {
    let initiations = 0;
    const messages = conversation.messages;

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].agentId === agentId) {
        const prevTopics = i > 0 ? messages[i - 1].topics || [] : [];
        const currentTopics = messages[i].topics || [];

        // Check for new topics introduced
        const newTopics = currentTopics.filter(
          (topic) => !prevTopics.includes(topic)
        );
        if (newTopics.length > 0) {
          initiations++;
        }
      }
    }

    return initiations / Math.max(1, messages.length);
  }

  // Update the vector store upsert to handle the Promise
  private async upsertToVectorStore(message: Message, metadata: any) {
    const embedding = await this.vectorStore.createEmbedding(message.content);
    await this.vectorStore.upsert({
      id: `msg-${message.id}`,
      values: embedding,
      metadata: {
        type: "conversation_message",
        conversationId: metadata.conversationId,
        agentId: message.agentId,
        content: message.content,
        sentiment: message.sentiment?.toString(),
        topics: message.topics?.join(","),
        timestamp: message.timestamp,
        location: metadata.location,
        activity: metadata.activity,
        contextualRelevance: metadata.contextualRelevance?.toString(),
        naturalTransitions: metadata.naturalTransitions?.toString(),
        conversationDepth: metadata.conversationDepth?.toString(),
        emotionalDynamics: JSON.stringify(metadata.emotionalDynamics),
      },
    });
  }

  // Add method to reset daily counts
  private resetDailyCounts() {
    this.agentConversationCounts.clear();
    this.dailyAPICallCount = 0;
    console.log("🔄 Reset daily conversation counts and API calls");
  }

  public async handleUserMessage(
    conversationId: string,
    userMessage: string
  ): Promise<void> {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Add user message to conversation
    const userMessageObj: Message = {
      id: `msg-${Date.now()}`,
      agentId: "user",
      content: userMessage,
      timestamp: Date.now(),
      role: "user",
      topics: conversation.topics,
    };

    await this.addMessage(conversationId, userMessageObj);

    // Get conversation state and context for enhanced responses
    const state = await this.analyzeConversationState(conversation);
    const context = await this.getEnvironmentalContext(conversation);

    // Get all active conversations to check agent availability
    const activeConversations = await this.getActiveConversations();

    // Get the last few speakers to ensure variety
    const recentSpeakers = conversation.messages
      .slice(-3)
      .map((msg) => msg.agentId);

    // Sort participants by their availability and last message time
    // Exclude recent speakers to ensure conversation variety
    const availableParticipants = conversation.participants.filter(
      (participant) => !recentSpeakers.includes(participant.id)
    );

    if (availableParticipants.length === 0) {
      // If all participants have spoken recently, reset with all participants except the last speaker
      const lastSpeaker = recentSpeakers[recentSpeakers.length - 1];
      availableParticipants.push(
        ...conversation.participants.filter(
          (participant) => participant.id !== lastSpeaker
        )
      );
    }

    // Randomly select 1-2 participants to respond
    const respondingParticipants = availableParticipants
      .sort(() => Math.random() - 0.5)
      .slice(0, 1 + Math.floor(Math.random() * 2));

    // Process responses from selected participants
    for (const agent of respondingParticipants) {
      const isBusy = activeConversations.some(
        (conv) =>
          conv.id !== conversationId &&
          conv.participants.some((p) => p.id === agent.id)
      );

      if (isBusy) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.USER_MESSAGE_RESPONSE_DELAY * 2)
        );
        console.log(
          `Waiting for ${agent.name} to finish their other conversation...`
        );
      }

      // Generate enhanced system prompt with rich context
      const systemPrompt = await this.generateEnhancedSystemPrompt(
        agent,
        conversation,
        state,
        context
      );

      // Add initial response delay
      await new Promise((resolve) =>
        setTimeout(resolve, this.messageDelayConfig.responseDelay)
      );

      // Generate response using enhanced context
      const response = await this.generateEnhancedResponse(
        agent,
        conversation,
        systemPrompt,
        state
      );

      // Simulate typing time
      await this.simulateTyping(response.length);

      // Create and add agent's response message
      const agentMessage: Message = {
        id: `msg-${Date.now()}`,
        agentId: agent.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: await this.vectorStore.analyzeSentiment(response),
      };

      await this.addMessageWithDelay(conversation.id, agentMessage);

      // Add natural delay between agent responses
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.random() *
            (this.USER_MESSAGE_RESPONSE_DELAY * 1.5 -
              this.USER_MESSAGE_RESPONSE_DELAY) +
            this.USER_MESSAGE_RESPONSE_DELAY
        )
      );
    }
  }

  public async broadcastSystemMessage(content: string) {
    const systemMessage: Message = {
      id: `msg-${Date.now()}`,
      agentId: "system",
      content,
      timestamp: Date.now(),
      role: "system",
      topics: [],
    };

    // Get all active conversations
    const activeConvs = await this.getActiveConversations();

    // Add the system message to each active conversation
    for (const conversation of activeConvs) {
      await this.addMessage(conversation.id, systemMessage);

      // Broadcast to district
      this.districtService.broadcastMessage(conversation.districtId, {
        type: "system_message",
        data: {
          conversationId: conversation.id,
          content: systemMessage.content,
          timestamp: systemMessage.timestamp,
        },
      });

      // Trigger agent reactions to the system message
      const participants = conversation.participants;
      for (const agent of participants) {
        // Add a small delay between agent responses
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 + Math.random() * 2000)
        );

        // Generate and add agent's response to the system message
        const response = await this.generateEnhancedResponse(
          agent,
          conversation,
          `You are reacting to this system announcement: ${content}. Express your thoughts or feelings about it.`,
          await this.analyzeConversationState(conversation)
        );

        const agentMessage: Message = {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          content: response,
          timestamp: Date.now(),
          role: "assistant",
          sentiment: await this.vectorStore.analyzeSentiment(response),
        };

        await this.addMessageWithDelay(conversation.id, agentMessage);
      }
    }
  }
}
