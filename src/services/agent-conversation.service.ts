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
  private readonly maxConversationDuration = 2 * 60 * 1000; // 2 minutes
  private readonly messageInterval = 5000; // 5 seconds between messages

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
    const baseRoutines = [
      {
        timeSlot: 7,
        activity: "early_exercise",
        location: "Fitness Center",
        possibleTopics: ["health", "wellness", "morning routine"],
        socialProbability: 0.4,
      },
      {
        timeSlot: 9,
        activity: "morning_coffee",
        location: "Local Café",
        possibleTopics: ["community", "news", "work life"],
        socialProbability: 0.6,
      },
      {
        timeSlot: 12,
        activity: "lunch_break",
        location: "Restaurant",
        possibleTopics: ["food", "culture", "local events"],
        socialProbability: 0.7,
      },
      {
        timeSlot: 15,
        activity: "afternoon_meeting",
        location: "Community Center",
        possibleTopics: ["district development", "community projects"],
        socialProbability: 0.8,
      },
      {
        timeSlot: 17,
        activity: "evening_leisure",
        location: "Park",
        possibleTopics: ["recreation", "events", "hobbies"],
        socialProbability: 0.5,
      },
      {
        timeSlot: 19,
        activity: "cultural_event",
        location: "Cultural Hub",
        possibleTopics: ["arts", "performances", "exhibitions"],
        socialProbability: 0.7,
      },
    ];

    return this.shuffleAndSelectRoutines(baseRoutines);
  }

  private shuffleAndSelectRoutines(routines: AgentActivity[]): AgentActivity[] {
    const shuffled = [...routines].sort(() => Math.random() - 0.5);
    const numRoutines = Math.floor(Math.random() * 3) + 3; // 3-5 routines per agent
    return shuffled.slice(0, numRoutines);
  }

  public async generateAIRoutines(agent: Agent): Promise<AgentActivity[]> {
    try {
      const prompt = `Generate daily routines for an AI city agent with the following traits:
        - Personality: ${agent.personality}
        - Interests: ${agent.interests.join(", ")}
        - Traits: ${Object.entries(agent.traits)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")}
        
        Format: Return a JSON array of routines with timeSlot (0-23), activity name, location, possible conversation topics, and social probability (0-1).`;

      const response = await this.togetherService.generateText(prompt);

      try {
        const aiRoutines = JSON.parse(response);
        return this.validateAndFormatRoutines(aiRoutines);
      } catch {
        return this.generateInitialRoutines();
      }
    } catch (error) {
      console.error("Failed to generate AI routines:", error);
      return this.generateInitialRoutines();
    }
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
    // Update agent activities every 30 seconds
    setInterval(() => this.updateAgentActivities(), 30 * 1000);

    // Generate natural conversations every 30 seconds
    setInterval(() => this.generateNaturalConversations(), 30 * 1000);

    // Update social networks every hour
    setInterval(() => this.updateSocialNetworks(), 60 * 60 * 1000);

    // Process ongoing conversations
    setInterval(() => this.updateOngoingConversations(), 10 * 1000);
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
    const districts = await this.cityCoordinator.getActiveDistricts();

    for (const district of districts) {
      // Get all agents in this district
      const districtAgents = Array.from(this.registeredAgents.values())
        .filter((agent) => agent.districtId === district.id)
        .map((agent) => agent.id);

      if (districtAgents.length < 2) continue;

      // Get cultural and social context
      const culturalContext = await this.cultureService.getDistrictCulture(
        district.id
      );
      const socialMood = await this.socialDynamics.getCommunityMood(
        district.id
      );

      // Group agents by current activity
      const currentHour = new Date().getHours();
      const activities = new Map<string, string[]>();

      // Add agents to activities
      for (const agentId of districtAgents) {
        const agent = this.getAgent(agentId);
        if (!agent) continue;

        // Skip if agent is already in a conversation
        if (this.isAgentInConversation(agentId)) continue;

        // Determine current activity based on time
        const activity = this.determineActivity(currentHour);

        if (!activities.has(activity)) {
          activities.set(activity, []);
        }
        activities.get(activity)!.push(agentId);
      }

      // Process each activity group
      for (const [activity, agents] of activities.entries()) {
        // Skip if not enough agents
        if (agents.length < 2) continue;

        // Calculate chance for spontaneous conversation
        const conversationChance = this.calculateSpontaneousConversationChance(
          activity,
          culturalContext,
          socialMood
        );

        if (Math.random() < conversationChance) {
          // Select participants based on social compatibility
          const participants = this.selectCompatibleParticipants(
            agents,
            activity,
            culturalContext
          );

          // Start a contextual conversation
          await this.startContextualConversation(participants, {
            activity,
            districtId: district.id,
            culturalContext,
            socialMood,
          });

          // Log conversation start
          console.log(
            `Started conversation in district ${district.id} with participants:`,
            participants
          );

          // Broadcast conversation start
          this.districtService.broadcastMessage(district.id, {
            type: "conversation_started",
            data: {
              participants: participants.map((id) => {
                const agent = this.getAgent(id);
                return {
                  id: agent?.id,
                  name: agent?.name,
                  role: agent?.role,
                };
              }),
              activity,
              location: this.determineConversationLocation(activity),
            },
            timestamp: Date.now(),
          });
        }
      }
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

      // Schedule next message
      setTimeout(() => {
        this.continueConversation(conversation).catch(console.error);
      }, 5000); // First response after 5 seconds

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
      const message = await this.generateNextMessage(conversation);
      await this.addMessage(conversation.id, message);

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

      // Schedule next message with random delay (5-15 seconds)
      const delay = 5000 + Math.random() * 10000;
      setTimeout(() => {
        this.continueConversation(conversation).catch(console.error);
      }, delay);

      // End conversation after a while (random between 5-10 messages)
      if (conversation.messages.length >= 5 + Math.floor(Math.random() * 5)) {
        conversation.status = "ended";
        conversation.endTime = Date.now();

        console.log("\n=== Conversation Ended ===");
        console.log("Conversation ID:", conversation.id);
        console.log("Total Messages:", conversation.messages.length);
        console.log(
          "Duration:",
          (conversation.endTime - conversation.startTime) / 1000,
          "seconds"
        );
        console.log("========================\n");

        // Broadcast conversation end
        this.districtService.broadcastMessage(conversation.districtId, {
          type: "conversation_ended",
          data: {
            conversationId: conversation.id,
            participants: conversation.participants.map((agent) => ({
              id: agent.id,
              name: agent.name,
              role: agent.role,
            })),
            location: conversation.location,
            activity: conversation.activity,
            duration: conversation.endTime - conversation.startTime,
            messageCount: conversation.messages.length,
          },
        });
      }
    } catch (error) {
      console.error("Error continuing conversation:", error);
      throw error;
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

    // Get last speaker and next speaker
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const nextSpeaker = conversation.participants.find(
      (p) => p.id !== lastMessage?.agentId
    );

    if (!nextSpeaker) {
      throw new Error("No next speaker found");
    }

    console.log("Next speaker:", nextSpeaker.name);

    try {
      // Add system context
      const systemPrompt = `You are ${nextSpeaker.name}, a ${nextSpeaker.role} with the following personality: ${nextSpeaker.personality}.
      You are having a conversation at ${conversation.location} during ${conversation.activity}.
      The topic is: ${conversation.topic}
      
      Respond naturally as your character would, keeping responses concise (1-2 sentences).
      Consider your role, personality, and the ongoing conversation context.`;

      console.log("Calling Together API...");
      console.log("System prompt:", systemPrompt);

      // Call Together API using generateResponse
      const response = await this.togetherService.generateResponse(
        nextSpeaker,
        conversation.messages,
        systemPrompt
      );

      console.log("Together API response:", response);

      // Create message object
      const message: Message = {
        id: `msg-${Date.now()}`,
        agentId: nextSpeaker.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: 0.7,
      };

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
}
