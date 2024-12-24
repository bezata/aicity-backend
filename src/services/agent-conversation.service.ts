import { EventEmitter } from "events";
import { Agent, AgentTraits } from "../types/agent.types";
import { Message } from "../types/conversation.types";
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
  status: "active" | "ended";
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
  private readonly maxConversationDuration = 10 * 60 * 1000; // 10 minutes
  private readonly messageInterval = 60000; // 1 minute between messages
  private readonly maxConcurrentConversations = 1; // Only 1 conversation at a time
  private readonly minConversationCooldown = 5 * 60 * 1000; // 5 minutes cooldown between conversations
  private lastConversationTime: number = 0;
  private dailyAPICallCount: number = 0;
  private readonly maxDailyAPICalls: number = 100; // Limit daily API calls
  private readonly conversationStartHour: number = 8; // Start conversations at 8 AM
  private readonly conversationEndHour: number = 22; // End conversations at 10 PM
  private messageCache: Map<string, { content: string; timestamp: number }> =
    new Map();
  private readonly cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
  private agentConversationCounts: Map<
    string,
    { count: number; lastTime: number }
  > = new Map();
  private readonly maxDailyConversationsPerAgent = 5;
  private conversationTopics: string[] = [
    "district_development",
    "local_events",
    "community_projects",
    "cultural_activities",
    "neighborhood_improvements",
  ];
  private currentTopicIndex = 0;
  private readonly dynamicCooldownMultiplier = 1.5; // Increases cooldown when API usage is high
  private conversationQualityScores: Map<string, number> = new Map();
  private readonly minQualityThreshold = 0.6;

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
    this.initializeService();
  }

  public async registerAgent(agent: Agent): Promise<void> {
    this.registeredAgents.set(agent.id, agent);

    // Generate AI-powered routines or fall back to initial routines
    const routines = await this.generateAIRoutines(agent).catch(() =>
      this.generateInitialRoutines()
    );

    this.agentProfiles.set(agent.id, {
      friends: new Set(),
      regularLocations: [agent.districtId || "central"],
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

    // Check if agent is already in a conversation
    if (this.isAgentInConversation(agent.id)) return;

    // Find potential conversation partners in the same location
    const potentialPartners = Array.from(this.agentProfiles.entries())
      .filter(([otherId, otherProfile]) => {
        const otherActivity = otherProfile.routines.find(
          (r) => r.timeSlot === currentHour
        );
        return (
          otherId !== agent.id &&
          otherActivity?.location === currentActivity.location &&
          !this.isAgentInConversation(otherId)
        );
      })
      .map(([id]) => id);

    if (potentialPartners.length === 0) return;

    // Start a contextual conversation
    const districtId = profile.regularLocations[0] || "central";
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
        console.log("Found existing routines in Pinecone");
        return JSON.parse(results.matches[0].metadata.routines);
      }

      // If not found, generate new routines
      console.log("Generating new AI routines");
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

      const response = await this.togetherService.generateText(prompt);

      try {
        // Clean the response
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

        // Validate each routine
        routines.forEach((routine) => {
          if (!this.isValidRoutine(routine)) {
            throw new Error("Invalid routine object format");
          }
        });

        // Store in Pinecone
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
      // Import and register existing agents
      const { residentAgents, cityManagementAgents } = await import(
        "../config/city-agents.js"
      );
      const allAgents = [...residentAgents, ...cityManagementAgents];

      console.log(`Initializing ${allAgents.length} agents...`);

      // Register all agents
      for (const agent of allAgents) {
        await this.registerAgent(agent);
        console.log(`Registered agent: ${agent.name}`);
      }

      // Initialize base systems
      await this.initializeAISystem();
      this.initializeMetricsListening();

      // Start life simulation cycles
      this.startLifeCycles();
      console.log("Started life simulation cycles");

      // Start initial conversations
      await this.generateNaturalConversations();
      console.log("Generated initial conversations");

      // Set up periodic conversation generation
      setInterval(() => {
        this.generateNaturalConversations().catch(console.error);
      }, 5 * 60 * 1000); // Generate new conversations every 5 minutes

      // Set up conversation continuation
      setInterval(() => {
        this.continueActiveConversations().catch(console.error);
      }, 30 * 1000); // Continue conversations every 30 seconds
    } catch (error) {
      console.error("Error initializing agent conversation service:", error);
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
  private async generateNaturalConversations() {
    if (this.dailyAPICallCount >= this.maxDailyAPICalls) {
      console.log("⚠️ Daily API call limit reached");
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

    const dynamicCooldown = this.calculateDynamicCooldown();
    const timeSinceLastConversation = Date.now() - this.lastConversationTime;

    if (timeSinceLastConversation < dynamicCooldown) {
      console.log(
        `⏳ Dynamic cooldown active: ${Math.round(
          (dynamicCooldown - timeSinceLastConversation) / 1000
        )}s`
      );
      return;
    }

    // Check concurrent conversations
    const activeConversations = Array.from(
      this.activeConversations.values()
    ).filter((conv) => conv.status === "active");
    if (activeConversations.length >= this.maxConcurrentConversations) {
      console.log(
        `⚠️ Max concurrent conversations (${this.maxConcurrentConversations}) reached`
      );
      return;
    }

    // 80% chance to skip conversation generation to further reduce frequency
    if (Math.random() > 0.2) {
      console.log("🎲 Randomly skipping conversation generation (80% chance)");
      return;
    }

    // Proceed with conversation generation
    try {
      const districts = await this.cityCoordinator.getActiveDistricts();
      for (const district of districts) {
        await this.tryGenerateDistrictConversation(district);
        // Only attempt one district at a time
        break;
      }
    } catch (error) {
      console.error("Error in conversation generation:", error);
    }
  }

  private async tryGenerateDistrictConversation(district: any) {
    const districtAgents = Array.from(this.registeredAgents.values())
      .filter((agent) => agent.districtId === district.id)
      .map((agent) => agent.id);

    if (districtAgents.length < 2) return;

    // Get cultural and social context
    const culturalContext = await this.cultureService.getDistrictCulture(
      district.id
    );
    const socialMood = await this.socialDynamics.getCommunityMood(district.id);

    // Select 2 random agents for conversation
    const availableAgents = districtAgents.filter(
      (agentId) => !this.isAgentInConversation(agentId)
    );
    if (availableAgents.length < 2) return;

    const selectedAgents = this.selectCompatibleParticipants(
      availableAgents,
      this.determineActivity(new Date().getHours()),
      culturalContext
    ).slice(0, 2); // Limit to exactly 2 participants

    if (selectedAgents.length === 2) {
      await this.startContextualConversation(selectedAgents, {
        activity: this.determineActivity(new Date().getHours()),
        districtId: district.id,
        culturalContext,
        socialMood,
      });
      this.lastConversationTime = Date.now();
      this.dailyAPICallCount++;
    }
  }

  private determineActivity(hour: number): string {
    if (hour >= 6 && hour < 10) return "morning_coffee";
    if (hour >= 12 && hour < 14) return "lunch_break";
    if (hour >= 17 && hour < 21) return "evening_leisure";
    if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 17))
      return "cultural_event";
    return "evening_leisure"; // default activity
  }

  private selectCompatibleParticipants(
    availableAgents: string[],
    activity: string,
    culturalContext: any
  ): string[] {
    // Score each agent based on compatibility
    const scoredAgents = availableAgents.map((agentId) => {
      const agent = this.getAgent(agentId);
      if (!agent) return { agentId, score: 0 };

      let score = 0;

      // Activity preference
      const hasMatchingInterest = agent.interests.some((interest) => {
        return (
          activity.includes(interest) ||
          culturalContext.traditions.includes(interest) ||
          culturalContext.events.some((e: any) => e.type === interest)
        );
      });
      if (hasMatchingInterest) {
        score += 0.3;
      }

      // Cultural alignment
      const hasCulturalMatch = agent.interests.some((interest) => {
        return culturalContext.traditions.includes(interest);
      });
      if (hasCulturalMatch) {
        score += 0.2;
      }

      // Social traits
      if (agent.traits.enthusiasm > 0.7) {
        score += 0.2;
      }
      if (agent.traits.empathy > 0.7) {
        score += 0.2;
      }

      return { agentId, score };
    });

    // Sort by score and select top 2-3 agents
    const sortedAgents = scoredAgents
      .sort((a, b) => b.score - a.score)
      .map((a) => a.agentId);

    return sortedAgents.slice(0, 2 + Math.floor(Math.random() * 2));
  }

  private calculateSocialCompatibilityScore(
    agentId: string,
    activity: string,
    culturalContext: any
  ): number {
    const profile = this.agentProfiles.get(agentId);
    if (!profile) return 0;

    let score = 0;

    // Base score from personality
    score += profile.personality.extroversion * 0.3;
    score += profile.personality.culturalOpenness * 0.2;
    score += profile.personality.communityOrientation * 0.2;

    // Bonus for frequent activity participants
    if (profile.routines.some((r) => r.activity === activity)) {
      score += 0.2;
    }

    // Cultural engagement bonus
    if (
      profile.culturalPreferences.some(
        (pref) =>
          culturalContext.traditions.includes(pref) ||
          culturalContext.events.some((e: any) => e.type === pref)
      )
    ) {
      score += 0.3;
    }

    return Math.min(1, score);
  }
  private async startContextualConversation(
    participants: string[],
    context: ConversationContext
  ) {
    try {
      // Create conversation
      const conversation = await this.createConversation(participants, context);
      console.log("\n=== New Conversation Started ===");
      console.log("Conversation ID:", conversation.id);
      console.log("District:", context.districtId);
      console.log(
        "Participants:",
        conversation.participants.map((p) => `${p.name} (${p.role})`)
      );
      console.log("Location:", conversation.location);
      console.log("Activity:", conversation.activity);
      console.log("Topic:", conversation.topic);
      console.log("================================\n");

      // Get initiator
      const initiator = this.getAgent(participants[0]);
      if (!initiator) {
        throw new Error("No initiator found for conversation");
      }

      // Generate initial message using Together API
      const systemPrompt = `You are ${initiator.name}, a ${initiator.role} with the following personality: ${initiator.personality}.
      You are starting a conversation at ${conversation.location} during ${conversation.activity}.
      The topic is: ${conversation.topic}
      
      Generate a natural conversation opener (1-2 sentences) that fits your character and the context.`;

      console.log("Generating initial message...");
      console.log("System prompt:", systemPrompt);

      const initialResponse = await this.togetherService.generateResponse(
        initiator,
        [], // No previous messages for the initial greeting
        systemPrompt
      );

      console.log("Initial message generated:", initialResponse);

      // Add the initial message
      await this.addMessage(conversation.id, {
        id: `msg-${Date.now()}`,
        agentId: initiator.id,
        content: initialResponse,
        timestamp: Date.now(),
        role: "assistant",
      });

      // Broadcast conversation start
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
        },
      });

      // Schedule next message with longer delay
      setTimeout(() => {
        this.continueConversation(conversation).catch(console.error);
      }, 30000); // First response after 30 seconds

      return conversation;
    } catch (error) {
      console.error("Error starting contextual conversation:", error);
      throw error;
    }
  }

  private scheduleConversationUpdates(conversationId: string) {
    const updateInterval = setInterval(async () => {
      const conversation = this.activeConversations.get(conversationId);
      if (!conversation || conversation.status !== "active") {
        clearInterval(updateInterval);
        return;
      }

      await this.continueConversation(conversation);
    }, 5000); // Generate new message every 5 seconds

    // Clear interval after 2 minutes
    setTimeout(() => {
      clearInterval(updateInterval);
      this.endConversation(conversationId);
    }, 2 * 60 * 1000);
  }

  private async addInitialMessage(conversation: AgentConversation) {
    const initiator = conversation.participants[0];
    const greeting = this.generateContextualGreeting(
      initiator,
      conversation.location,
      conversation.activity
    );

    await this.addMessage(conversation.id, {
      id: `msg-${Date.now()}`,
      agentId: initiator.id,
      content: greeting,
      timestamp: Date.now(),
      role: "assistant",
    });
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
      // Check API call limit
      if (this.dailyAPICallCount >= this.maxDailyAPICalls) {
        console.log("⚠️ Daily API call limit reached, ending conversation");
        await this.endConversation(conversation.id);
        return;
      }

      // Check time of day
      const currentHour = new Date().getHours();
      if (
        currentHour < this.conversationStartHour ||
        currentHour >= this.conversationEndHour
      ) {
        console.log("⏰ Outside conversation hours, ending conversation");
        await this.endConversation(conversation.id);
        return;
      }

      const message = await this.generateNextMessage(conversation);
      await this.addMessage(conversation.id, message);
      this.dailyAPICallCount++;

      const agent = this.getAgent(message.agentId);
      console.log(`[Message] ${agent?.name}: ${message.content}`);

      // Broadcast the message
      this.districtService.broadcastMessage(conversation.districtId, {
        type: "agent_message",
        data: {
          conversationId: conversation.id,
          message: {
            content: message.content,
            agentId: message.agentId,
            timestamp: message.timestamp,
          },
          location: conversation.location,
          activity: conversation.activity,
        },
      });

      // 50% chance to end conversation after each message
      if (conversation.messages.length >= 2 && Math.random() > 0.5) {
        console.log(
          "🎲 Randomly ending conversation (50% chance after 2 messages)"
        );
        await this.endConversation(conversation.id);
        return;
      }

      // Schedule next message with long random delay (2-5 minutes)
      const delay = 120000 + Math.random() * 180000;
      setTimeout(() => {
        this.continueConversation(conversation).catch(console.error);
      }, delay);
    } catch (error) {
      console.error("Error continuing conversation:", error);
      await this.endConversation(conversation.id);
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

  private async endConversation(conversationId: string) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    conversation.status = "ended";
    conversation.endTime = Date.now();

    // Broadcast conversation end over WebSocket
    this.districtService.broadcastMessage(conversation.districtId, {
      type: "conversation_ended",
      data: {
        conversationId: conversation.id,
        participants: conversation.participants.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
        })),
        location: conversation.location,
        activity: conversation.activity,
        duration: conversation.endTime - conversation.startTime,
        timestamp: Date.now(),
      },
    });

    this.activeConversations.delete(conversationId);
    await this.storeConversationInVectorDB(conversation);
  }

  private async updateOngoingConversations() {
    for (const conversation of this.activeConversations.values()) {
      if (conversation.status === "active") {
        // Check if conversation should end
        const duration = Date.now() - conversation.startTime;
        if (duration > this.maxConversationDuration) {
          await this.endConversation(conversation.id);
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

  private getAgent(agentId: string): Agent | undefined {
    return this.registeredAgents.get(agentId);
  }

  private async addMessage(conversationId: string, message: Message) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    conversation.messages.push(message);
    conversation.lastUpdateTime = Date.now();

    // Update sentiment
    conversation.sentiment = await this.calculateConversationSentiment(
      conversation.messages
    );

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

    const conversation: AgentConversation = {
      id: `conv-${Date.now()}`,
      participants: participants
        .map((id) => this.getAgent(id))
        .filter(Boolean) as Agent[],
      messages: [],
      topic,
      districtId: context.districtId,
      location,
      activity: context.activity,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      status: "active",
      sentiment: 0.5,
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

  private async generateNextMessage(
    conversation: AgentConversation
  ): Promise<Message> {
    console.log("\n=== Generating Next Message ===");

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const nextSpeaker = conversation.participants.find(
      (p) => p.id !== lastMessage?.agentId
    );

    if (!nextSpeaker) {
      throw new Error("No next speaker found");
    }

    console.log("Next speaker:", nextSpeaker.name);

    try {
      // Check if agent can participate
      if (!this.canAgentParticipate(nextSpeaker.id)) {
        console.log("⚠️ Agent has reached daily conversation limit");
        await this.endConversation(conversation.id);
        throw new Error("Agent daily limit reached");
      }

      // Try to get cached response first
      const cacheKey = `${conversation.topic}-${nextSpeaker.id}-${conversation.messages.length}`;
      const cachedResponse = this.getCachedMessage(cacheKey);

      let response: string;
      if (cachedResponse) {
        response = cachedResponse;
      } else {
        const systemPrompt = `You are ${nextSpeaker.name}, a ${nextSpeaker.role} with the following personality: ${nextSpeaker.personality}.
        You are having a conversation at ${conversation.location} during ${conversation.activity}.
        The topic is: ${conversation.topic}
        
        Respond naturally as your character would, keeping responses concise (1-2 sentences).
        Consider your role, personality, and the ongoing conversation context.`;

        console.log("Calling Together API...");
        response = await this.togetherService.generateResponse(
          nextSpeaker,
          conversation.messages,
          systemPrompt
        );

        // Cache the response
        this.cacheMessage(cacheKey, response);
      }

      // Update agent participation
      this.updateAgentParticipation(nextSpeaker.id);

      // Create message object
      const message: Message = {
        id: `msg-${Date.now()}`,
        agentId: nextSpeaker.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: 0.7,
      };

      // Update conversation quality
      await this.updateConversationQuality(conversation);

      return message;
    } catch (error) {
      console.error("Error generating message:", error);
      throw error;
    }
  }

  private isAgentInConversation(agentId: string): boolean {
    return Array.from(this.activeConversations.values()).some(
      (conv) =>
        conv.status === "active" &&
        conv.participants.some((p) => p.id === agentId)
    );
  }

  private calculateSpontaneousConversationChance(
    activity: string,
    culturalContext: any,
    socialMood: any
  ): number {
    let chance = 0.6; // Higher base chance

    // Modify based on activity type
    const activityModifiers: Record<string, number> = {
      morning_coffee: 0.5, // People are more social during coffee
      lunch_break: 0.6, // Social lunch time
      cultural_event: 0.7, // High interaction during events
      evening_leisure: 0.5, // Relaxed social time
    };
    chance += activityModifiers[activity] || 0;

    // Increase chance during cultural events
    if (culturalContext.events.length > 0) {
      chance += 0.3;
    }

    // Adjust based on social mood
    chance += (socialMood.positivity || 0.5) * 0.3;
    chance += (socialMood.engagement || 0.5) * 0.3;

    return Math.min(1.0, chance); // Cap at 100% chance
  }

  private getCachedMessage(key: string): string | null {
    const cached = this.messageCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log("🎯 Using cached message");
      return cached.content;
    }
    return null;
  }

  private cacheMessage(key: string, content: string) {
    this.messageCache.set(key, {
      content,
      timestamp: Date.now(),
    });
  }

  private getNextTopic(): string {
    const topic = this.conversationTopics[this.currentTopicIndex];
    this.currentTopicIndex =
      (this.currentTopicIndex + 1) % this.conversationTopics.length;
    return topic;
  }

  private calculateDynamicCooldown(): number {
    const apiUsageRatio = this.dailyAPICallCount / this.maxDailyAPICalls;
    const baseCooldown = this.minConversationCooldown;
    return baseCooldown * (1 + apiUsageRatio * this.dynamicCooldownMultiplier);
  }

  private async updateConversationQuality(conversation: AgentConversation) {
    const messageCount = conversation.messages.length;
    const uniqueContent = new Set(conversation.messages.map((m) => m.content))
      .size;
    const contentDiversity = uniqueContent / messageCount;
    const averageLength =
      conversation.messages.reduce((sum, msg) => sum + msg.content.length, 0) /
      messageCount;

    const qualityScore =
      contentDiversity * 0.5 +
      Math.min(averageLength / 100, 1) * 0.3 +
      Math.min(messageCount / 5, 1) * 0.2;

    this.conversationQualityScores.set(conversation.id, qualityScore);

    if (qualityScore < this.minQualityThreshold) {
      console.log(
        `⚠️ Low quality conversation detected (score: ${qualityScore.toFixed(
          2
        )})`
      );
      await this.endConversation(conversation.id);
    }
  }

  private canAgentParticipate(agentId: string): boolean {
    const stats = this.agentConversationCounts.get(agentId) || {
      count: 0,
      lastTime: 0,
    };
    const isNewDay =
      new Date(stats.lastTime).getDate() !== new Date().getDate();

    if (isNewDay) {
      stats.count = 0;
    }

    return stats.count < this.maxDailyConversationsPerAgent;
  }

  private updateAgentParticipation(agentId: string) {
    const stats = this.agentConversationCounts.get(agentId) || {
      count: 0,
      lastTime: 0,
    };
    stats.count++;
    stats.lastTime = Date.now();
    this.agentConversationCounts.set(agentId, stats);
  }
}
