import { EventEmitter } from "events";
import { Agent, AgentTraits } from "../types/agent.types";
import { CityEvent, CityEventCategory } from "../types/city-events";
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { getAgent } from "../config/city-agents";
import { CityService } from "./city.service";
import type { WeatherState, CityMood } from "../types/city.types";
import { Message } from "../types/conversation.types";
import _ from "lodash";
import { CulturalEvent } from "../types/culture.types";
import { AnalyticsService } from "./analytics.service";
import { AIIntegrationService } from "./ai-integration.service";

type VectorMetadataType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport";

interface CollaborationSession {
  id: string;
  eventId: string;
  agents: string[];
  status:
    | "planning"
    | "discussing"
    | "implementing"
    | "reviewing"
    | "completed"
    | "failed"
    | "scheduled"
    | "pending";
  messages: Array<{
    agentId: string;
    content: string;
    timestamp: number;
    sentiment?: number;
    topics?: string[];
  }>;
  decisions: Array<{
    description: string;
    proposedBy: string;
    supportedBy: string[];
    priority: number;
    impact: {
      environmental: number;
      social: number;
      economic: number;
      cultural?: number;
    };
    implementation: {
      steps: string[];
      timeline: number;
      resources: string[];
    };
    status: "proposed" | "approved" | "in_progress" | "completed";
    timestamp: number;
  }>;
  metrics: {
    consensusLevel: number;
    progressRate: number;
    effectiveness: number;
    culturalAlignment?: number;
    participationScore: Record<string, number>;
    topicsAnalyzed?: number;
    consensusLevels?: number[];
    averageConsensus?: number;
  };
  history: Array<{
    action: string;
    timestamp: number;
    details: any;
  }>;
  culturalEvents?: CulturalEvent[];
}

interface CollaborationConfig {
  minConsensusThreshold: number;
  maxDiscussionRounds: number;
  decisionTimeoutMs: number;
  emergencyProtocolThreshold: number;
}

type AgentTrait = keyof AgentTraits;

export class AgentCollaborationService extends EventEmitter {
  private activeSessions = new Map<string, CollaborationSession>();
  private responseCache = new Map<
    string,
    { content: string; timestamp: number }
  >();
  private readonly responseCacheDuration = 30 * 60 * 1000; // 30 minutes
  private readonly decisionCache = new Map<
    string,
    { decision: any; timestamp: number }
  >();
  private readonly decisionCacheDuration = 5 * 60 * 1000; // 5 minutes

  private config: CollaborationConfig = {
    minConsensusThreshold: 0.7,
    maxDiscussionRounds: 2,
    decisionTimeoutMs: 30000,
    emergencyProtocolThreshold: 1.5,
  };

  constructor(
    private togetherService: TogetherService,
    private vectorStore: VectorStoreService,
    private cityService: CityService,
    private analyticsService: AnalyticsService,
    private aiIntegrationService: AIIntegrationService
  ) {
    super();
    this.initializeService();
  }

  private initializeService() {
    this.setupPeriodicMaintenance();
    this.setupEventHandlers();

    // Create a test collaboration session
    this.createTestSession();
  }

  private async createTestSession() {
    const testEvent: CityEvent = {
      id: crypto.randomUUID(),
      title: "Emergency Response Department Monthly Planning",
      description:
        "Monthly strategic planning and coordination meeting to discuss department goals and initiatives.",
      category: "development",
      severity: 0.6,
      duration: 2, // 2 hours
      urgency: 0.7,
      impact: {
        environmental: 0.4,
        social: 0.8,
        economic: 0.7,
      },
      requiredAgents: ["safety", "services", "mayor"], // Department heads and mayor
      affectedDistricts: ["emergency-response-dept"],
      status: "pending",
      timestamp: Date.now() + 24 * 60 * 60 * 1000, // Schedule for tomorrow
    };

    try {
      const sessionId = await this.initiateCollaboration(testEvent);
      console.log("Monthly planning session created:", sessionId);

      // Add initial discussion points
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.messages.push({
          agentId: "system",
          content:
            "Monthly planning session initiated. Agenda items:\n1. Review of previous month's performance\n2. Current challenges and solutions\n3. Resource allocation for next month\n4. Emergency preparedness updates",
          timestamp: Date.now(),
          topics: ["planning", "review", "resources", "emergency-preparedness"],
        });
      }
    } catch (error) {
      console.error("Failed to create monthly planning session:", error);
    }
  }

  private setupPeriodicMaintenance() {
    setInterval(() => this.maintainSessions(), 60 * 60 * 1000); // Every hour
    setInterval(() => this.monitorActiveSessions(), 5 * 60 * 1000); // Every 5 minutes
    setInterval(() => this.cleanupCaches(), 15 * 60 * 1000); // Every 15 minutes
  }

  private setupEventHandlers() {
    this.on("collaborationStarted", (session: CollaborationSession) => {
      session.agents.forEach((agentId: string) => {
        this.analyticsService.trackAgentActivity(agentId);
      });

      const agent: Agent = {
        id: session.id,
        name: "Collaboration System",
        personality: "Systematic",
        systemPrompt: "Manage collaboration sessions",
        interests: ["collaboration", "coordination"],
        preferredStyle: "instructional",
        traits: {
          analyticalThinking: 1,
          creativity: 0.5,
          empathy: 0.7,
          curiosity: 0.6,
          enthusiasm: 0.5,
        },
        memoryWindowSize: 10,
        emotionalRange: { min: 0.3, max: 0.8 },
        role: "assistant",
      };

      const message: Message = {
        id: crypto.randomUUID(),
        agentId: agent.id,
        content: `Collaboration session started with ${session.agents.length} participants`,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: 0.7,
        topics: ["collaboration", "session", "start"],
      };

      this.analyticsService.trackInteraction(agent, message);
    });

    this.on("collaborationEnded", (session: CollaborationSession) => {
      session.agents.forEach((agentId: string) => {
        this.analyticsService.trackAgentActivity(agentId);
      });

      const agent: Agent = {
        id: session.id,
        name: "Collaboration System",
        personality: "Systematic",
        systemPrompt: "Manage collaboration sessions",
        interests: ["collaboration", "coordination"],
        preferredStyle: "instructional",
        traits: {
          analyticalThinking: 1,
          creativity: 0.5,
          empathy: 0.7,
          curiosity: 0.6,
          enthusiasm: 0.5,
        },
        memoryWindowSize: 10,
        emotionalRange: { min: 0.3, max: 0.8 },
        role: "assistant",
      };

      const message: Message = {
        id: crypto.randomUUID(),
        agentId: agent.id,
        content: `Collaboration session ended with consensus level: ${session.metrics.consensusLevel}`,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: session.metrics.consensusLevel,
        topics: ["collaboration", "session", "end", "consensus"],
      };

      this.analyticsService.trackInteraction(agent, message);
    });

    this.on(
      "decisionMade",
      (decision: {
        sessionId: string;
        description: string;
        confidence: number;
        category: string;
      }) => {
        const agent: Agent = {
          id: decision.sessionId,
          name: "Collaboration System",
          personality: "Systematic",
          systemPrompt: "Manage collaboration sessions",
          interests: ["collaboration", "coordination"],
          preferredStyle: "instructional",
          traits: {
            analyticalThinking: 1,
            creativity: 0.5,
            empathy: 0.7,
            curiosity: 0.6,
            enthusiasm: 0.5,
          },
          memoryWindowSize: 10,
          emotionalRange: { min: 0.3, max: 0.8 },
          role: "assistant",
        };

        const message: Message = {
          id: crypto.randomUUID(),
          agentId: agent.id,
          content: decision.description,
          timestamp: Date.now(),
          role: "assistant",
          sentiment: decision.confidence,
          topics: ["decision", decision.category, "collaboration"],
        };

        this.analyticsService.trackInteraction(agent, message);
      }
    );
  }

  async getSessionStatus(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const status = {
      id: sessionId,
      status: session.status,
      agents: session.agents.map((id) => ({
        id,
        name: getAgent(id)?.name,
        participationScore: session.metrics.participationScore[id],
      })),
      messages: session.messages,
      decisions: session.decisions,
      metrics: session.metrics,
    };

    return status;
  }

  async getAllSessions() {
    const sessions = [];
    for (const sessionId of this.activeSessions.keys()) {
      try {
        const status = await this.getSessionStatus(sessionId);
        sessions.push(status);
      } catch (error) {
        console.error(`Error getting status for session ${sessionId}:`, error);
      }
    }
    return sessions;
  }

  async initiateCollaboration(event: CityEvent) {
    const sessionId = `collab-${event.id}-${Date.now()}`;

    // Check for similar active sessions
    const similarSession = await this.findSimilarSession(event);
    if (similarSession) {
      return this.mergeWithExistingSession(similarSession, event);
    }

    // If no required agents specified, select some based on the event
    if (!event.requiredAgents || event.requiredAgents.length === 0) {
      event.requiredAgents = await this.findDomainExperts(event.category);
    }

    // Select and optimize agents first
    const selectedAgents = await this.optimizeAgentSelection(event);

    // Map event status to session status
    let sessionStatus: CollaborationSession["status"] = "planning";
    if (String(event.status) === "scheduled") {
      sessionStatus = "scheduled";
    } else if (String(event.status) === "in_progress") {
      sessionStatus = "implementing";
    } else if (String(event.status) === "completed") {
      sessionStatus = "completed";
    }

    // Create new session
    const session: CollaborationSession = {
      id: sessionId,
      eventId: event.id,
      agents: selectedAgents,
      status: sessionStatus,
      messages: [],
      decisions: [],
      metrics: {
        consensusLevel: 0,
        progressRate: 0,
        effectiveness: 0,
        participationScore: {},
        topicsAnalyzed: 0,
        consensusLevels: [],
        averageConsensus: 0,
      },
      history: [
        {
          action: "session_created",
          timestamp: event.timestamp || Date.now(),
          details: { event, initialAgents: selectedAgents },
        },
      ],
    };

    // Store session in active sessions
    this.activeSessions.set(sessionId, session);

    // Store session context in vector store
    await this.vectorStore.upsert({
      id: `collab-context-${sessionId}`,
      values: await this.vectorStore.createEmbedding(
        `${event.title} ${event.description} ${event.category}`
      ),
      metadata: {
        type: "collaboration",
        subtype: "context",
        sessionId,
        topic: event.title,
        participants: selectedAgents.filter(Boolean).join(","),
        timestamp: event.timestamp || Date.now(),
        category: event.category,
        status: sessionStatus,
        consensusLevel: "0",
        participation: "0",
        effectiveness: "0",
      },
    });

    // Only start discussion if not scheduled
    if (sessionStatus !== "scheduled") {
      await this.facilitateDiscussion(sessionId, event);
    } else {
      // Emit event for scheduled collaboration
      this.emit("collaborationScheduled", {
        sessionId,
        event,
        agents: selectedAgents,
        timestamp: event.timestamp,
      });
    }

    return sessionId;
  }

  private async findSimilarSession(event: CityEvent) {
    const activeSessions = Array.from(this.activeSessions.values());
    return activeSessions.find(
      (session) =>
        session.status !== "completed" &&
        session.status !== "failed" &&
        this.calculateSessionSimilarity(session, event) > 0.8
    );
  }

  private calculateSessionSimilarity(
    session: CollaborationSession,
    event: CityEvent
  ) {
    // Calculate similarity based on various factors
    let similarity = 0;
    let factors = 0;

    // Check if events are in the same category
    if (session.eventId === event.id) {
      similarity += 1;
      factors += 1;
    }

    // Compare affected districts
    const commonDistricts = event.affectedDistricts.filter((d) =>
      session.history[0]?.details?.event?.affectedDistricts?.includes(d)
    ).length;
    if (commonDistricts > 0) {
      similarity +=
        commonDistricts /
        Math.max(
          event.affectedDistricts.length,
          session.history[0]?.details?.event?.affectedDistricts?.length || 1
        );
      factors += 1;
    }

    // Compare required agents
    const commonAgents = event.requiredAgents.filter((a) =>
      session.agents.includes(a)
    ).length;
    if (commonAgents > 0) {
      similarity +=
        commonAgents /
        Math.max(event.requiredAgents.length, session.agents.length);
      factors += 1;
    }

    // Compare impact metrics
    if (session.history[0]?.details?.event?.impact) {
      const eventImpact = event.impact;
      const sessionImpact = session.history[0].details.event.impact;

      let impactSimilarity = 0;
      let impactFactors = 0;

      for (const metric of [
        "environmental",
        "social",
        "economic",
        "cultural",
      ] as const) {
        if (
          typeof eventImpact[metric] === "number" &&
          typeof sessionImpact[metric] === "number"
        ) {
          impactSimilarity +=
            1 - Math.abs(eventImpact[metric] - sessionImpact[metric]);
          impactFactors += 1;
        }
      }

      if (impactFactors > 0) {
        similarity += impactSimilarity / impactFactors;
        factors += 1;
      }
    }

    return factors > 0 ? similarity / factors : 0;
  }

  private async mergeWithExistingSession(
    session: CollaborationSession,
    event: CityEvent
  ) {
    // Add new agents to the session
    const newAgents = event.requiredAgents.filter(
      (a) => !session.agents.includes(a)
    );
    session.agents.push(...newAgents);

    // Update session history
    session.history.push({
      action: "session_merged",
      timestamp: Date.now(),
      details: {
        event,
        newAgents,
        previousAgents: session.agents.filter((a) => !newAgents.includes(a)),
      },
    });

    // Initialize participation scores for new agents
    newAgents.forEach((agentId) => {
      session.metrics.participationScore[agentId] = 0;
    });

    // Emit event about session merge
    this.emit("collaborationMerged", {
      sessionId: session.id,
      originalEvent: session.history[0]?.details?.event,
      mergedEvent: event,
      agents: session.agents,
      timestamp: Date.now(),
    });

    return session.id;
  }

  private async findDomainExperts(
    category: CityEventCategory
  ): Promise<string[]> {
    const experts: string[] = [];

    // Add domain-specific experts based on category
    switch (category) {
      case "cultural":
        experts.push("father_michael", "rabbi_sarah", "imam_hassan"); // Religious leaders for cultural events
        break;
      case "development":
        experts.push("sophia", "raj", "vision"); // Urban Planning, Infrastructure, Strategic Planning
        break;
      case "emergency":
        experts.push("cipher", "matrix", "catalyst"); // Security, Data, Change Management
        break;
      case "social":
        experts.push("aurora", "prism", "bridge"); // Wellness, Diversity, Community Relations
        break;
      case "transport":
        experts.push("marcus", "raj", "horizon"); // Transportation, Infrastructure, Future Trends
        break;
      case "community":
        experts.push("spark", "nexus", "weaver"); // Community Organizer, Network Coordinator, Cultural Storyteller
        break;
      default:
        // Default mix of management and resident agents
        experts.push("vision", "nexus", "catalyst");
    }

    // Add a domain expert if needed
    if (experts.length < 3) {
      experts.push("vision"); // Strategic planner as backup
    }

    // Add a community connector
    if (!experts.includes("bridge") && !experts.includes("nexus")) {
      experts.push("nexus");
    }

    return experts;
  }

  private async optimizeAgentSelection(event: CityEvent) {
    // Start with required agents
    const selectedAgents = [...event.requiredAgents];

    try {
      // Get agent embeddings for the event context
      const eventEmbedding = await this.vectorStore.createEmbedding(
        `${event.title} ${event.description} ${event.category}`
      );

      // Query for relevant agent interactions
      const query = await this.vectorStore.query({
        vector: eventEmbedding,
        filter: {
          type: { $eq: "collaboration" },
          category: { $eq: event.category },
        },
        topK: 5,
      });

      // Extract successful collaborators from past events
      const successfulCollaborators = new Set<string>();
      for (const match of query.matches) {
        if (match.metadata.success && match.metadata.agents) {
          match.metadata.agents.forEach((agentId: string) => {
            if (!selectedAgents.includes(agentId)) {
              successfulCollaborators.add(agentId);
            }
          });
        }
      }

      // Add successful collaborators if needed
      const optimalTeamSize = Math.min(5, event.requiredAgents.length + 2);
      const additionalAgentsNeeded = optimalTeamSize - selectedAgents.length;

      if (additionalAgentsNeeded > 0) {
        const sortedCollaborators = Array.from(successfulCollaborators)
          .filter((agentId) => {
            const agent = getAgent(agentId);
            return agent && this.isAgentSuitable(agent, event);
          })
          .slice(0, additionalAgentsNeeded);

        selectedAgents.push(...sortedCollaborators);
      }

      // Ensure we have at least the required agents
      if (selectedAgents.length < event.requiredAgents.length) {
        console.warn(
          `Optimized agent selection resulted in fewer agents than required. Using original selection.`
        );
        return event.requiredAgents;
      }

      return selectedAgents;
    } catch (error: any) {
      console.error(
        "Error in agent selection optimization:",
        error.message || "Unknown error"
      );
      return event.requiredAgents;
    }
  }

  private isAgentSuitable(agent: Agent, event: CityEvent) {
    // Check if agent's interests align with event category
    if (agent.interests.includes(event.category)) {
      return true;
    }

    // Check if agent has relevant traits for the event
    const relevantTraits = this.getRelevantTraits(event.category);
    const agentTraitScore =
      relevantTraits.reduce((score, trait) => {
        return score + (agent.traits[trait] || 0);
      }, 0) / relevantTraits.length;

    return agentTraitScore >= 0.7;
  }

  private getRelevantTraits(category: CityEventCategory): AgentTrait[] {
    switch (category) {
      case "cultural":
        return ["empathy", "creativity", "curiosity"];
      case "emergency":
        return ["analyticalThinking", "enthusiasm"];
      case "development":
        return ["analyticalThinking", "creativity"];
      case "social":
        return ["empathy", "enthusiasm"];
      case "transport":
        return ["analyticalThinking", "curiosity"];
      case "environmental":
        return ["analyticalThinking", "empathy"];
      case "community":
        return ["empathy", "enthusiasm", "curiosity"];
      default:
        return ["analyticalThinking", "empathy", "creativity"];
    }
  }

  private async facilitateDiscussion(sessionId: string, event: CityEvent) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    // Update session status
    session.status = "discussing";
    session.history.push({
      action: "discussion_started",
      timestamp: Date.now(),
      details: { event },
    });

    // Emit event
    this.emit("collaborationStarted", {
      sessionId,
      event,
      agents: session.agents,
      timestamp: Date.now(),
    });

    try {
      // Simulate discussion rounds
      let consensusReached = false;
      let currentRound = 0;

      while (
        !consensusReached &&
        currentRound < this.config.maxDiscussionRounds
      ) {
        currentRound++;

        // Add delay before each discussion round
        await this.simulateResponseDelay();

        // Simulate agent discussions and decision-making
        const decision = await this.simulateDecisionRound(session, event);

        // Track the decision
        session.decisions.push(decision);

        // Emit decision event
        this.emit("decisionMade", {
          sessionId,
          description: decision.description,
          proposedBy: decision.proposedBy,
          supportedBy: decision.supportedBy,
          confidence: decision.priority,
          category: event.category,
          timestamp: Date.now(),
        });

        // Check if consensus is reached
        if (
          decision.supportedBy.length / session.agents.length >=
          this.config.minConsensusThreshold
        ) {
          consensusReached = true;
          session.status = "completed";
          session.history.push({
            action: "consensus_reached",
            timestamp: Date.now(),
            details: { decision },
          });

          // Emit completion event
          this.emit("collaborationCompleted", {
            sessionId,
            event,
            decision,
            metrics: session.metrics,
            timestamp: Date.now(),
          });
        }
      }

      // If no consensus is reached after max rounds
      if (!consensusReached) {
        session.status = "failed";
        session.history.push({
          action: "consensus_failed",
          timestamp: Date.now(),
          details: { rounds: currentRound },
        });

        // Emit failure event
        this.emit("collaborationFailed", {
          sessionId,
          event,
          reason: "No consensus reached after maximum rounds",
          metrics: session.metrics,
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      session.status = "failed";
      session.history.push({
        action: "error",
        timestamp: Date.now(),
        details: { error: error.message || "Unknown error occurred" },
      });

      // Emit failure event
      this.emit("collaborationFailed", {
        sessionId,
        event,
        reason: error.message || "Unknown error occurred",
        metrics: session.metrics,
        timestamp: Date.now(),
      });
    }
  }

  private async simulateResponseDelay(): Promise<void> {
    const minDelay = 15000; // 15 seconds
    const maxDelay = 30000; // 30 seconds
    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private generateCacheKey(sessionId: string, context: any): string {
    return `${sessionId}:${JSON.stringify(context)}`;
  }

  private async simulateDecisionRound(
    session: CollaborationSession,
    event: CityEvent
  ) {
    const cacheKey = this.generateCacheKey(session.id, {
      eventId: event.id,
      status: session.status,
      agentCount: session.agents.length,
      messageCount: session.messages.length,
      consensusLevel: session.metrics.consensusLevel,
    });

    // Check cache for recent decision
    const cachedDecision = this.decisionCache.get(cacheKey);
    if (
      cachedDecision &&
      Date.now() - cachedDecision.timestamp < this.decisionCacheDuration
    ) {
      console.log("Using cached decision for session:", session.id);
      return cachedDecision.decision;
    }

    // Simulate response delay for more realistic agent interactions
    await this.simulateResponseDelay();

    // Generate discussion messages from each agent
    for (const agentId of session.agents) {
      const prompt = `Generate a realistic message from ${agentId} discussing ${event.title}. The message should:
      - Be in first person
      - Reference the event details and goals
      - Include specific suggestions or concerns
      - Be professional but conversational
      Format: Just the message content, no additional text.`;

      const messageContent = await this.togetherService.generateText(prompt);

      session.messages.push({
        agentId,
        content: messageContent,
        timestamp: Date.now(),
        topics: [event.category, "planning", "collaboration"],
      });
    }

    // Simulate a decision round between agents
    const decision = {
      description: `Decision for ${event.title}`,
      proposedBy: session.agents[0],
      supportedBy: session.agents.slice(
        0,
        Math.ceil(session.agents.length * 0.8)
      ),
      priority: Math.random(),
      impact: event.impact,
      implementation: {
        steps: ["Plan", "Execute", "Review"],
        timeline: event.duration,
        resources: ["Time", "Budget", "Personnel"],
      },
      status: "proposed" as const,
      timestamp: Date.now(),
    };

    // Cache the decision
    this.decisionCache.set(cacheKey, {
      decision,
      timestamp: Date.now(),
    });

    // Update session metrics
    session.metrics.consensusLevel =
      decision.supportedBy.length / session.agents.length;
    session.metrics.progressRate += 0.2;
    session.metrics.effectiveness = Math.min(
      1,
      session.metrics.effectiveness + 0.1
    );

    // Update participation scores
    decision.supportedBy.forEach((agentId) => {
      session.metrics.participationScore[agentId] =
        (session.metrics.participationScore[agentId] || 0) + 0.1;
    });

    return decision;
  }

  private async generateResponse(prompt: string) {
    const cacheKey = `response:${prompt}`;
    const cachedResponse = this.responseCache.get(cacheKey);

    if (
      cachedResponse &&
      Date.now() - cachedResponse.timestamp < this.responseCacheDuration
    ) {
      console.log("Using cached response for prompt");
      return cachedResponse.content;
    }

    // Add delay before generating response
    await this.delay();

    const response = await this.togetherService.generateText(prompt);

    // Cache the response
    this.responseCache.set(cacheKey, {
      content: response,
      timestamp: Date.now(),
    });

    return response;
  }

  private async storeSessionContext(sessionId: string, event: CityEvent) {
    try {
      const contextKey = `context:${sessionId}:${event.id}`;
      const contextVector = await this.vectorStore.createEmbedding(
        `${event.title} ${event.description} ${event.category}`
      );

      // Store event context
      await this.vectorStore.upsert({
        id: `collab-context-${sessionId}`,
        values: contextVector,
        metadata: {
          type: "collaboration",
          subtype: "context",
          sessionId,
          eventId: event.id,
          category: event.category,
          severity: event.severity,
          urgency: event.urgency,
          affectedDistricts: event.affectedDistricts,
          timestamp: event.timestamp,
          status: event.status || "scheduled",
          title: event.title,
          description: event.description,
          departmentId: event.affectedDistricts[0], // Using first district as department ID
          participants: event.requiredAgents.join(","),
        },
      });

      // Store agent context
      for (const agentId of event.requiredAgents) {
        const agent = getAgent(agentId);
        if (agent) {
          await this.vectorStore.upsert({
            id: `collab-agent-${sessionId}-${agentId}`,
            values: await this.vectorStore.createEmbedding(
              `Agent ${agent.name} with interests in ${agent.interests.join(
                ", "
              )} ` +
                `and traits: ${Object.entries(agent.traits)
                  .map(([trait, value]) => `${trait}=${value}`)
                  .join(", ")}`
            ),
            metadata: {
              type: "collaboration",
              subtype: "agent",
              sessionId,
              agentId,
              interests: agent.interests,
              timestamp: event.timestamp,
            },
          });
        }
      }
    } catch (error: any) {
      console.error(
        `Failed to store context for session ${sessionId}:`,
        error.message || "Unknown error"
      );
      // Don't throw error to allow session to continue
    }
  }

  private async getCityContext() {
    return {
      weather: await this.cityService.getCurrentWeather(),
      mood: await this.cityService.getCityMood(),
    };
  }

  private async maintainSessions() {
    // Clean up completed or failed sessions older than 24 hours
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const lastUpdate =
        session.history[session.history.length - 1]?.timestamp || 0;

      if (
        lastUpdate < cutoffTime &&
        (session.status === "completed" || session.status === "failed")
      ) {
        // Archive session data before removal
        await this.archiveSession(sessionId, session);
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private async monitorActiveSessions() {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      // Skip completed or failed sessions
      if (session.status === "completed" || session.status === "failed") {
        continue;
      }

      // Check for stalled sessions
      const lastUpdate =
        session.history[session.history.length - 1]?.timestamp || 0;
      const timeSinceLastUpdate = Date.now() - lastUpdate;

      if (timeSinceLastUpdate > this.config.decisionTimeoutMs) {
        session.status = "failed";
        session.history.push({
          action: "timeout",
          timestamp: Date.now(),
          details: { timeSinceLastUpdate },
        });

        // Emit failure event
        this.emit("collaborationFailed", {
          sessionId,
          event: { id: session.eventId } as CityEvent,
          reason: "Session timed out due to inactivity",
          metrics: session.metrics,
          timestamp: Date.now(),
        });
      }

      // Update session metrics
      this.updateSessionMetrics(session);
    }
  }

  private async archiveSession(
    sessionId: string,
    session: CollaborationSession
  ) {
    try {
      // Store session data in vector store for future reference
      await this.vectorStore.upsert({
        id: `archived-session-${sessionId}`,
        values: await this.vectorStore.createEmbedding(
          `Collaboration session ${sessionId} - Status: ${session.status} - ` +
            `Agents: ${session.agents.join(", ")} - ` +
            `Decisions: ${session.decisions
              .map((d) => d.description)
              .join("; ")}`
        ),
        metadata: {
          type: "collaboration",
          subtype: "archive",
          sessionId,
          status: session.status,
          agentCount: session.agents.length,
          decisionCount: session.decisions.length,
          consensusLevel: session.metrics.consensusLevel,
          effectiveness: session.metrics.effectiveness,
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      console.error(
        `Failed to archive session ${sessionId}:`,
        error.message || "Unknown error"
      );
    }
  }

  private updateSessionMetrics(session: CollaborationSession) {
    // Update consensus levels history
    session.metrics.consensusLevels = session.metrics.consensusLevels || [];
    session.metrics.consensusLevels.push(session.metrics.consensusLevel);

    // Calculate average consensus
    session.metrics.averageConsensus =
      session.metrics.consensusLevels.reduce((sum, level) => sum + level, 0) /
      session.metrics.consensusLevels.length;

    // Count analyzed topics
    session.metrics.topicsAnalyzed = new Set(
      session.messages.flatMap((m) => m.topics || [])
    ).size;

    // Normalize participation scores
    const maxParticipation = Math.max(
      ...Object.values(session.metrics.participationScore)
    );
    if (maxParticipation > 0) {
      for (const [agentId, score] of Object.entries(
        session.metrics.participationScore
      )) {
        session.metrics.participationScore[agentId] = score / maxParticipation;
      }
    }
  }

  async recordAgentInteraction(
    agentId1: string,
    agentId2: string,
    content: string
  ) {
    try {
      const interaction = {
        id: crypto.randomUUID(),
        agentId1,
        agentId2,
        content,
        timestamp: Date.now(),
      };

      // Emit agent interaction event
      this.emit("agentInteraction", {
        ...interaction,
        type: "direct_interaction",
      });

      // Store interaction in vector store for future reference
      await this.vectorStore.upsert({
        id: `interaction-${interaction.id}`,
        values: await this.vectorStore.createEmbedding(content),
        metadata: {
          type: "collaboration",
          subtype: "interaction",
          agentId1,
          agentId2,
          timestamp: interaction.timestamp,
        },
      });

      return interaction;
    } catch (error: any) {
      console.error(
        "Failed to record agent interaction:",
        error.message || "Unknown error"
      );
      throw new Error("Failed to record agent interaction");
    }
  }

  private async delay() {
    const minDelay = 15000; // 15 seconds
    const maxDelay = 30000; // 30 seconds
    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Add cache cleanup method
  private cleanupCaches() {
    const now = Date.now();

    // Clean response cache
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.responseCacheDuration) {
        this.responseCache.delete(key);
      }
    }

    // Clean decision cache
    for (const [key, value] of this.decisionCache.entries()) {
      if (now - value.timestamp > this.decisionCacheDuration) {
        this.decisionCache.delete(key);
      }
    }
  }
}
