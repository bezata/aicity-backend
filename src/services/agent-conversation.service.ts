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
  private readonly maxConversationDuration = 20 * 60 * 1000; // 10 minutes
  private readonly messageInterval = 60000; // 1 minute between messages
  private readonly maxConcurrentConversations = 10; // Only 1 conversation at a time
  private readonly minConversationCooldown = 1 * 60 * 1000; // 5 minutes cooldown between conversations
  private lastConversationTime: number = 0;
  private dailyAPICallCount: number = 0;
  private readonly maxDailyAPICalls: number = 1000; // Limit daily API calls
  private readonly conversationStartHour: number = 8; // Start conversations at 8 AM
  private readonly conversationEndHour: number = 22; // End conversations at 10 PM
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
      console.log("🚀 Starting agent conversation service...");

      // Import and register existing agents
      const { residentAgents, cityManagementAgents } = await import(
        "../config/city-agents.ts"
      );

      const allAgents = [...residentAgents, ...cityManagementAgents];
      console.log(`Found ${allAgents.length} agents to initialize...`);

      // Register all agents
      for (const agent of allAgents) {
        await this.registerAgent(agent);
        console.log(`✅ Registered agent: ${agent.name}`);
      }

      // Start initial conversations immediately
      console.log("🗣️ Starting initial conversations...");
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
          console.log(
            `🤝 Started conversation between ${agent1.name} and ${agent2.name}`
          );
        }
      }

      // Set up periodic conversation generation
      setInterval(() => {
        this.generateNaturalConversations().catch(console.error);
      }, 30000); // Generate new conversations every 30 seconds

      // Continue active conversations frequently
      setInterval(() => {
        this.continueActiveConversations().catch(console.error);
      }, 15000); // Continue conversations every 15 seconds

      console.log("🌟 Agent conversation service initialized and running!");
    } catch (error) {
      console.error("❌ Error initializing agent conversation service:", error);
    }
  }

  private async generateNaturalConversations() {
    try {
      // Get the Downtown District
      const district = await this.districtService.getDistrict(
        "a42ed892-3878-45a5-9a1a-4ceaf9524f1c"
      );
      if (!district) {
        console.error("❌ District not found");
        return;
      }

      // Get all registered agents that aren't in active conversations
      const activeAgentIds = new Set(
        Array.from(this.activeConversations.values())
          .filter((conv) => conv.status === "active")
          .flatMap((conv) => conv.participants.map((p) => p.id))
      );

      const availableAgents = Array.from(this.registeredAgents.values()).filter(
        (agent) => !activeAgentIds.has(agent.id)
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
        `✨ Started natural conversation with ${participants.length} agents:`,
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
          timestamp: Date.now(),
        },
      });

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

      // Store conversation in vector store if it's district-related
      if (context.districtId) {
        await this.upsertConversationToDistrict(context.districtId, {
          id: conversation.id,
          participants: conversation.participants.map((p) => p.id),
          content: initialResponse,
          topics: [conversation.topic],
          sentiment: 0.7, // Initial neutral-positive sentiment
          activity: context.activity,
        });
      }

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

  public getAgent(agentId: string): Agent | undefined {
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

    // Broadcast message through WebSocket
    this.districtService.broadcastMessage(conversation.districtId, {
      type: "conversation_message",
      data: {
        conversationId,
        message: {
          content: message.content,
          agentId: message.agentId,
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
        // Generate a more natural and specific system prompt
        const systemPrompt = `You are ${nextSpeaker.name}, a ${nextSpeaker.role}.
        Personality: ${nextSpeaker.personality}
        Location: ${conversation.location}
        Activity: ${conversation.activity}
        Topic: ${conversation.topic}
        
        You are having a natural conversation. Respond in character, considering your role and personality.
        Keep your response concise (1-2 sentences) and engaging.
        Make sure to acknowledge the context and previous messages if any exist.
        
        Remember:
        - Stay in character as ${nextSpeaker.name}
        - Consider your role as ${nextSpeaker.role}
        - Reflect your personality: ${nextSpeaker.personality}`;

        console.log("Calling Together API...");

        // Try up to 3 times to get a valid response
        let attempts = 0;
        const maxAttempts = 3;
        let apiResponse: string | undefined;

        while (attempts < maxAttempts) {
          attempts++;
          console.log(`Attempt ${attempts} of ${maxAttempts}`);

          // Emit retry event before each attempt
          if (attempts > 1) {
            this.emit("retry", {
              agentId: nextSpeaker.id,
              attempt: attempts,
              reason: "Empty or invalid response from API",
              waitTime: 2000,
            });
          }

          apiResponse = await this.togetherService.generateResponse(
            nextSpeaker,
            conversation.messages,
            systemPrompt
          );

          if (apiResponse && apiResponse.trim()) {
            break;
          }

          console.log(`Empty response on attempt ${attempts}, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
        }

        // Use the API response if valid, otherwise use fallback
        response =
          apiResponse?.trim() ||
          this.generateFallbackResponse(nextSpeaker, conversation);

        // Cache the successful response
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
        sentiment: await this.vectorStore.analyzeSentiment(response),
      };

      // Update conversation quality
      await this.updateConversationQuality(conversation);

      return message;
    } catch (error) {
      console.error("Error generating message:", error);
      throw error;
    }
  }

  private generateFallbackResponse(
    agent: Agent,
    conversation: AgentConversation
  ): string {
    const responses = [
      `I've been thinking about our ${conversation.topic} here in the district.`,
      `It's interesting to consider how ${conversation.topic} affects our community.`,
      `From my perspective as a ${agent.role}, ${conversation.topic} is quite important.`,
      `Being here at ${conversation.location}, I often reflect on ${conversation.topic}.`,
      `As someone involved in ${conversation.activity}, I find ${conversation.topic} fascinating.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
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
    userMessage: string
  ) {
    const agent = this.getAgent(agentId);
    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      return;
    }

    const systemPrompt = `You are ${agent.name}, a ${agent.role} with the following personality: ${agent.personality}.
    A user has sent the following message: "${userMessage}"
    
    Generate a natural response (1-2 sentences) that fits your character.`;

    try {
      const response = await this.togetherService.generateResponse(
        agent,
        [], // No previous messages needed for direct response
        systemPrompt
      );

      // Broadcast the agent's response
      this.districtService.broadcastMessage(districtId, {
        type: "agent_response",
        data: {
          agentId,
          agentName: agent.name,
          agentRole: agent.role,
          content: response,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error(`Error generating agent response:`, error);
    }
  }
}
