import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import { Message } from "../types/conversation.types";
import { VectorStoreService } from "./vector-store.service";
import {
  CityMetrics,
  MetricsUpdate,
  MetricsContext,
} from "../types/city-metrics.types";
import { CityCoordinatorService } from "./city-coordinator.service";
import { AIIntegrationService } from "./ai-integration.service";

interface AgentConversation {
  id: string;
  participants: Agent[];
  messages: Message[];
  topic: string;
  location: string;
  startTime: number;
  lastUpdateTime: number;
  status: "active" | "completed";
  sentiment: number;
  environmentalContext?: {
    carbonEmissions: number;
    energyRatio: number;
  };
  economicContext?: {
    employmentRate: number;
    jobGrowth: number;
    giniCoefficient: number;
  };
}

export class AgentConversationService extends EventEmitter {
  private activeConversations: Map<string, AgentConversation> = new Map();
  private agentInterests: Map<string, Set<string>> = new Map();
  private lastInteractionTime: Map<string, number> = new Map();
  private currentMetrics?: CityMetrics;

  constructor(
    private vectorStore: VectorStoreService,
    private cityCoordinator: CityCoordinatorService,
    private aiIntegration: AIIntegrationService
  ) {
    super();
    this.initializeService();
  }

  private async initializeService() {
    this.startAutonomousConversations();
    this.initializeMetricsListening();
    await this.initializeAISystem();
  }

  private async initializeAISystem() {
    if (!this.aiIntegration.isInitialized()) {
      await this.aiIntegration.initializeSystem({
        agents: Array.from(this.agentInterests.keys()),
        protocol: {
          name: "city_conversation",
          version: "1.0",
          rules: [
            "Maintain context awareness across conversations",
            "Consider historical interactions",
            "Adapt to changing city metrics",
            "Prioritize collaborative problem-solving",
          ],
        },
        initialState: {
          metrics: this.currentMetrics,
          activeConversations: Array.from(
            this.activeConversations.values()
          ).map((conv) => ({
            id: conv.id,
            topic: conv.topic,
            participants: conv.participants.map((p) => p.id),
          })),
        },
      });
    }
  }

  private initializeMetricsListening() {
    // Listen for metrics updates
    this.cityCoordinator.on("metricsUpdated", (update: MetricsUpdate) => {
      this.handleMetricsUpdate(update);
    });

    // Get initial metrics and ensure all required properties are present
    const baseMetrics = this.cityCoordinator.getCurrentMetrics();
    this.currentMetrics = {
      carbonEmissions: baseMetrics.sustainability.carbonEmissions || 0,
      energyRatio: baseMetrics.sustainability.renewableEnergyRatio || 0,
      timestamp: Date.now(),
      economy: baseMetrics.economy || {
        employmentRate: 0,
        jobGrowth: 0,
        giniCoefficient: 0,
        businessFormationRate: 0,
        affordabilityIndex: 0,
      },
    };
  }

  private handleMetricsUpdate(update: MetricsUpdate) {
    if (
      update.type === "full" &&
      update.metrics.carbonEmissions !== undefined
    ) {
      this.currentMetrics = {
        carbonEmissions: update.metrics.carbonEmissions,
        energyRatio: update.metrics.energyRatio || 0,
        timestamp: Date.now(),
        economy: update.metrics.economy || {
          employmentRate: 0,
          jobGrowth: 0,
          giniCoefficient: 0,
          businessFormationRate: 0,
          affordabilityIndex: 0,
        },
      };
    } else if (update.metrics.economy) {
      this.currentMetrics = {
        ...this.currentMetrics!,
        economy: update.metrics.economy,
        timestamp: Date.now(),
      };
    }

    // Trigger discussions if metrics change significantly
    this.checkForEnvironmentalDiscussions();
    this.checkForEconomicDiscussions();
  }

  private async checkForEnvironmentalDiscussions() {
    if (!this.currentMetrics) return;

    // Check for concerning metrics
    const highCarbonEmissions = this.currentMetrics.carbonEmissions > 10;
    const lowEnergyEfficiency = this.currentMetrics.energyRatio < 0.3;

    if (highCarbonEmissions || lowEnergyEfficiency) {
      // Find environmental experts
      const experts = Array.from(this.agentInterests.entries())
        .filter(
          ([_, interests]) =>
            interests.has("environmental sustainability") ||
            interests.has("energy efficiency") ||
            interests.has("urban ecology")
        )
        .map(([agentId]) => agentId);

      // Start discussions between experts
      if (experts.length >= 2) {
        const topic = highCarbonEmissions
          ? "carbon emissions"
          : "energy efficiency";
        await this.startConversation(experts.slice(0, 2), topic);
      }
    }
  }

  private async checkForEconomicDiscussions() {
    if (!this.currentMetrics?.economy) return;

    const { employmentRate, jobGrowth, giniCoefficient } =
      this.currentMetrics.economy;

    // Check for concerning economic metrics
    const highUnemployment = employmentRate < 0.9;
    const lowJobGrowth = jobGrowth < 1.0;
    const highInequality = giniCoefficient > 0.4;

    if (highUnemployment || lowJobGrowth || highInequality) {
      // Find economic experts
      const experts = Array.from(this.agentInterests.entries())
        .filter(
          ([_, interests]) =>
            interests.has("economic development") ||
            interests.has("business innovation") ||
            interests.has("workforce development")
        )
        .map(([agentId]) => agentId);

      // Start discussions between experts
      if (experts.length >= 2) {
        let topic = "economic challenges";
        if (highUnemployment) topic = "employment opportunities";
        else if (lowJobGrowth) topic = "job growth strategies";
        else if (highInequality) topic = "economic inequality";

        await this.startConversation(experts.slice(0, 2), topic);
      }
    }
  }

  private async startConversation(agentIds: string[], suggestedTopic?: string) {
    const conversationId = `conv-${Date.now()}`;
    const topic = suggestedTopic || this.findCommonTopic(agentIds);
    const location = this.selectRandomLocation();

    const conversation: AgentConversation = {
      id: conversationId,
      participants: agentIds
        .map((id) => this.getAgent(id))
        .filter((a): a is Agent => !!a),
      messages: [],
      topic,
      location,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      status: "active",
      sentiment: 0.5,
      environmentalContext: this.currentMetrics
        ? {
            carbonEmissions: this.currentMetrics.carbonEmissions,
            energyRatio: this.currentMetrics.energyRatio,
          }
        : undefined,
      economicContext: this.currentMetrics?.economy
        ? {
            employmentRate: this.currentMetrics.economy.employmentRate,
            jobGrowth: this.currentMetrics.economy.jobGrowth,
            giniCoefficient: this.currentMetrics.economy.giniCoefficient,
          }
        : undefined,
    };

    this.activeConversations.set(conversationId, conversation);
    this.emit("conversationStarted", conversation);

    await this.addMessage(conversationId, {
      id: `msg-${Date.now()}`,
      agentId: conversation.participants[0].id,
      content: this.generateGreeting(conversation),
      timestamp: Date.now(),
      role: "assistant",
    });
  }

  private generateGreeting(conversation: AgentConversation): string {
    if (conversation.economicContext) {
      const { employmentRate, jobGrowth, giniCoefficient } =
        conversation.economicContext;

      if (employmentRate < 0.9) {
        return `I'm concerned about our employment rate (${(
          employmentRate * 100
        ).toFixed(
          1
        )}%). We should discuss strategies to create more job opportunities.`;
      }
      if (jobGrowth < 1.0) {
        return `Our job growth rate is concerning (${jobGrowth.toFixed(
          1
        )}%). Let's explore ways to stimulate economic growth.`;
      }
      if (giniCoefficient > 0.4) {
        return `Our Gini coefficient (${giniCoefficient.toFixed(
          2
        )}) indicates growing inequality. We should address this issue.`;
      }
    }

    if (conversation.environmentalContext) {
      const { carbonEmissions, energyRatio } =
        conversation.environmentalContext;
      if (carbonEmissions > 10) {
        return `I've noticed our carbon emissions are quite high (${carbonEmissions.toFixed(
          1
        )}). We should discuss ways to address this.`;
      }
      if (energyRatio < 0.3) {
        return `Our energy efficiency ratio is concerning (${energyRatio.toFixed(
          2
        )}). Shall we explore improvements?`;
      }
    }

    return `Hello! I noticed we both have an interest in ${conversation.topic}. Would you like to discuss it?`;
  }

  private startAutonomousConversations() {
    // Periodically check for potential conversations
    setInterval(() => this.initiateRandomConversations(), 5 * 60 * 1000); // Every 5 minutes
    setInterval(() => this.updateOngoingConversations(), 30 * 1000); // Every 30 seconds
  }

  private async initiateRandomConversations() {
    const availableAgents = Array.from(this.agentInterests.keys()).filter(
      (agentId) => !this.isAgentBusy(agentId)
    );

    // Randomly pair agents with similar interests
    for (let i = 0; i < availableAgents.length - 1; i += 2) {
      const agent1Id = availableAgents[i];
      const agent2Id = availableAgents[i + 1];

      if (this.shouldAgentsInteract(agent1Id, agent2Id)) {
        await this.startConversation([agent1Id, agent2Id]);
      }
    }
  }

  private async updateOngoingConversations() {
    for (const conversation of this.activeConversations.values()) {
      if (conversation.status === "active") {
        await this.continueConversation(conversation);
      }
    }
  }

  private async continueConversation(conversation: AgentConversation) {
    if (this.shouldEndConversation(conversation)) {
      await this.endConversation(conversation.id);
      return;
    }

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const nextSpeaker = this.selectNextSpeaker(
      conversation,
      lastMessage?.agentId
    );

    if (nextSpeaker) {
      const response = await this.generateResponse(nextSpeaker, conversation);
      await this.addMessage(conversation.id, {
        id: `msg-${Date.now()}`,
        agentId: nextSpeaker.id,
        content: response,
        timestamp: Date.now(),
        role: "assistant",
      });
    }
  }

  private async endConversation(conversationId: string) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    conversation.status = "completed";
    this.emit("conversationEnded", conversation);

    // Store conversation patterns
    const conversationText = conversation.messages
      .map((m) => m.content)
      .join(" ");
    const context: MetricsContext = {
      environmental: conversation.environmentalContext,
      economic: conversation.economicContext,
    };

    await this.aiIntegration.storePattern(
      conversationText,
      {
        topic: conversation.topic,
        participants: conversation.participants.map((p) => p.id),
        contextData: context,
      },
      0.8
    );

    // Store in vector database
    await this.vectorStore.upsert({
      id: conversationId,
      values: await this.vectorStore.createEmbedding(conversationText),
      metadata: {
        type: "conversation" as const,
        senderId: conversation.participants[0].id,
        receiverId: conversation.participants[1]?.id || "",
        timestamp: conversation.startTime,
      },
    });
  }

  private shouldEndConversation(conversation: AgentConversation): boolean {
    const duration = Date.now() - conversation.startTime;
    const inactivityTime = Date.now() - conversation.lastUpdateTime;

    return (
      duration > 30 * 60 * 1000 || // Longer than 30 minutes
      inactivityTime > 5 * 60 * 1000 || // No messages for 5 minutes
      conversation.messages.length > 20 // Too many messages
    );
  }

  private selectNextSpeaker(
    conversation: AgentConversation,
    lastSpeakerId?: string
  ): Agent | undefined {
    return conversation.participants.find((p) => p.id !== lastSpeakerId);
  }

  private async generateResponse(
    agent: Agent,
    conversation: AgentConversation
  ): Promise<string> {
    const context = conversation.messages
      .slice(-3)
      .map((m) => `${this.getAgentName(m.agentId)}: ${m.content}`)
      .join("\n");

    // Find similar past decisions and patterns
    const [similarDecisions, similarPatterns] = await Promise.all([
      this.aiIntegration.findSimilarDecisions(context, 3),
      this.aiIntegration.findSimilarPatterns(context, 3),
    ]);

    // Record this decision
    const response = this.generateContextAwareResponse(
      agent,
      conversation,
      similarDecisions,
      similarPatterns
    );

    const metricsContext: MetricsContext = {
      environmental: conversation.environmentalContext,
      economic: conversation.economicContext,
      previousMessages: conversation.messages.slice(-3),
    };

    await this.aiIntegration.recordDecision(agent.id, response, {
      conversationId: conversation.id,
      topic: conversation.topic,
      contextData: metricsContext,
    });

    return response;
  }

  private generateContextAwareResponse(
    agent: Agent,
    conversation: AgentConversation,
    similarDecisions: any[],
    similarPatterns: any[]
  ): string {
    // Use agent personality and historical context to generate response
    const hasEconomicConcerns =
      conversation.economicContext &&
      (conversation.economicContext.employmentRate < 0.9 ||
        conversation.economicContext.jobGrowth < 1.0 ||
        conversation.economicContext.giniCoefficient > 0.4);

    const hasEnvironmentalConcerns =
      conversation.environmentalContext &&
      (conversation.environmentalContext.carbonEmissions > 10 ||
        conversation.environmentalContext.energyRatio < 0.3);

    // Generate response based on context and historical patterns
    if (
      hasEconomicConcerns &&
      agent.interests.includes("economic development")
    ) {
      return `As ${
        agent.name
      }, I believe we need to address our economic challenges. Based on historical patterns, similar situations were resolved through ${
        similarPatterns[0]?.pattern || "collaborative initiatives"
      }.`;
    }

    if (
      hasEnvironmentalConcerns &&
      agent.interests.includes("environmental sustainability")
    ) {
      return `As ${
        agent.name
      }, I'm concerned about our environmental metrics. Looking at past successful interventions, we should consider ${
        similarPatterns[0]?.pattern || "sustainable solutions"
      }.`;
    }

    return `As ${agent.name}, I find the topic of ${
      conversation.topic
    } fascinating. Previous discussions suggest ${
      similarDecisions[0]?.decision || "we should explore innovative approaches"
    }.`;
  }

  private findCommonTopic(agentIds: string[]): string {
    const commonInterests = agentIds
      .map((id) => this.agentInterests.get(id))
      .reduce((common, interests) => {
        if (!interests) return common;
        return common
          ? new Set([...common].filter((x) => interests.has(x)))
          : interests;
      }, new Set<string>());

    return (
      Array.from(commonInterests || new Set<string>())[0] || "city development"
    );
  }

  private selectRandomLocation(): string {
    const locations = [
      "Virtual Plaza",
      "Innovation Hub",
      "Knowledge Exchange",
      "Community Center",
      "Digital Garden",
      "Collaboration Space",
    ];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  private isAgentBusy(agentId: string): boolean {
    return Array.from(this.activeConversations.values()).some(
      (conv) =>
        conv.status === "active" &&
        conv.participants.some((p) => p.id === agentId)
    );
  }

  private shouldAgentsInteract(agent1Id: string, agent2Id: string): boolean {
    const interests1 = this.agentInterests.get(agent1Id);
    const interests2 = this.agentInterests.get(agent2Id);
    if (!interests1 || !interests2) return false;

    // Check for common interests
    const commonInterests = new Set(
      [...interests1].filter((x) => interests2.has(x))
    );
    return commonInterests.size > 0;
  }

  private getAgentName(agentId: string): string {
    return this.getAgent(agentId)?.name || agentId;
  }

  private getAgent(agentId: string): Agent | undefined {
    // Get agent from the active agents in the conversation service
    for (const conversation of this.activeConversations.values()) {
      const agent = conversation.participants.find((p) => p.id === agentId);
      if (agent) return agent;
    }
    return undefined;
  }

  // Public methods
  async registerAgent(agent: Agent) {
    this.agentInterests.set(agent.id, new Set(agent.interests));
    this.lastInteractionTime.set(agent.id, Date.now());
    await this.aiIntegration.recordAgentActivity(agent.id);
    this.emit("agentRegistered", agent);
  }

  async unregisterAgent(agentId: string) {
    this.agentInterests.delete(agentId);
    this.lastInteractionTime.delete(agentId);
    this.emit("agentUnregistered", agentId);
  }

  async getActiveConversations(): Promise<AgentConversation[]> {
    return Array.from(this.activeConversations.values()).filter(
      (conv) => conv.status === "active"
    );
  }

  private async addMessage(conversationId: string, message: Message) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) return;

    conversation.messages.push(message);
    conversation.lastUpdateTime = Date.now();

    // Update conversation sentiment
    conversation.sentiment = this.calculateConversationSentiment(conversation);

    this.emit("messageSent", { conversationId, message });
  }

  private calculateConversationSentiment(
    conversation: AgentConversation
  ): number {
    const recentMessages = conversation.messages.slice(-3);
    const sentiments = recentMessages.map((m) => m.sentiment || 0.5);
    return sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
  }
}
