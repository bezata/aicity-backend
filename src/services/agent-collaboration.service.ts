import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import { CityEvent } from "../types/city-events";
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { getAgent } from "../config/city-agents";
import { CityService } from "./city.service";
import type { WeatherState, CityMood } from "../types/city.types";
import { Message } from "../types/conversation.types";
import _ from "lodash";
import { CulturalEvent } from "../types/culture.types";

type VectorMetadataType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport";

interface CollaborationSession {
  eventId: string;
  agents: string[];
  status:
    | "planning"
    | "discussing"
    | "implementing"
    | "reviewing"
    | "completed"
    | "failed";
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

interface SessionMetrics {
  progressRate: number;
  effectiveness: number;
  participationScores: Record<string, number>;
}

interface Impact {
  environmental: number;
  social: number;
  economic: number;
  overall: number;
}

interface ConflictPoint {
  topic: string;
  positions: Map<string, string>;
}

interface VectorMetadata extends Record<string, any> {
  type: VectorMetadataType;
  sessionId: string;
  decisions?: string;
  metrics?: string;
  timestamp: number;
}

interface ConsensusPoint {
  count: number;
  supporters: string[];
}

export class AgentCollaborationService extends EventEmitter {
  private activeSessions: Map<string, CollaborationSession> = new Map();
  private readonly config: CollaborationConfig = {
    minConsensusThreshold: 0.7,
    maxDiscussionRounds: 5,
    decisionTimeoutMs: 30000,
    emergencyProtocolThreshold: 0.8,
  };

  constructor(
    private togetherService: TogetherService,
    private vectorStore: VectorStoreService,
    private cityService: CityService
  ) {
    super();
    this.setupPeriodicMaintenance();
  }

  private setupPeriodicMaintenance() {
    setInterval(() => this.maintainSessions(), 60 * 60 * 1000);
    setInterval(() => this.monitorActiveSessions(), 5 * 60 * 60 * 1000);
  }

  async initiateCollaboration(event: CityEvent) {
    const sessionId = `collab-${event.id}-${Date.now()}`;

    // Check for existing similar sessions
    const similarSession = await this.findSimilarSession(event);
    if (similarSession) {
      return this.mergeWithExistingSession(similarSession, event);
    }

    const session: CollaborationSession = {
      eventId: event.id,
      agents: await this.optimizeAgentSelection(event),
      status: "planning",
      messages: [],
      decisions: [],
      metrics: {
        consensusLevel: 0,
        progressRate: 0,
        effectiveness: 0,
        participationScore: {},
      },
      history: [
        {
          action: "session_created",
          timestamp: Date.now(),
          details: { event, initialAgents: event.requiredAgents },
        },
      ],
    };

    this.activeSessions.set(sessionId, session);
    await this.storeSessionContext(sessionId, event);
    await this.facilitateDiscussion(sessionId, event);

    return sessionId;
  }

  private async optimizeAgentSelection(event: CityEvent): Promise<string[]> {
    const requiredAgents = new Set(event.requiredAgents);
    const additionalAgents = new Set<string>();

    // Add domain experts based on event category
    const domainExperts = await this.findDomainExperts(event.category);
    domainExperts.forEach((expert) => additionalAgents.add(expert));

    // Add agents based on impact areas
    if (event.impact.environmental > 0.7) {
      additionalAgents.add("olivia"); // Environmental specialist
    }
    if (event.impact.social > 0.7) {
      additionalAgents.add("elena"); // Social cohesion specialist
    }
    if (event.impact.economic > 0.7) {
      additionalAgents.add("viktor"); // Economic specialist
    }

    return [...new Set([...requiredAgents, ...additionalAgents])];
  }

  private async facilitateDiscussion(sessionId: string, event: CityEvent) {
    const session = this.activeSessions.get(sessionId)!;
    let currentRound = 0;

    try {
      while (currentRound < this.config.maxDiscussionRounds) {
        const roundResult = await this.conductDiscussionRound(
          sessionId,
          event,
          currentRound
        );

        if (roundResult.consensusReached || roundResult.emergencyAction) {
          await this.finalizeDecisions(sessionId, roundResult);
          break;
        }

        currentRound++;
        await this.updateSessionMetrics(sessionId);
      }

      if (currentRound >= this.config.maxDiscussionRounds) {
        await this.handleNoConsensus(sessionId);
      }
    } catch (error) {
      await this.handleDiscussionError(sessionId, error);
    }
  }

  private async conductDiscussionRound(
    sessionId: string,
    event: CityEvent,
    round: number
  ) {
    const session = this.activeSessions.get(sessionId)!;
    const agents = session.agents
      .map((id) => getAgent(id))
      .filter((a): a is Agent => a !== undefined);
    const cityContext = await this.getCityContext();

    const roundResponses = new Map<string, string>();
    const consensusTracker = new Map<string, ConsensusPoint>();

    // Gather responses from all agents
    for (const agent of agents) {
      const prompt = this.buildCollaborationPrompt(
        agent,
        event,
        session.messages,
        cityContext,
        round
      );

      const response = await this.togetherService.generateResponse(agent, []);

      roundResponses.set(agent.id, response);
      await this.addMessage(sessionId, agent.id, response);

      // Analyze response for key points and update consensus tracker
      const keyPoints = await this.extractKeyPoints(response);
      keyPoints.forEach((point) => {
        const existing = consensusTracker.get(point) || {
          count: 0,
          supporters: [],
        };
        consensusTracker.set(point, {
          count: existing.count + 1,
          supporters: [...existing.supporters, agent.id],
        });
      });
    }

    // Calculate consensus level
    const consensusLevel = this.calculateConsensusLevel(
      consensusTracker,
      agents.length
    );
    const emergencyAction = await this.checkForEmergencyAction(
      event,
      roundResponses
    );

    return {
      consensusReached: consensusLevel >= this.config.minConsensusThreshold,
      emergencyAction,
      consensusPoints: Array.from(consensusTracker.entries())
        .filter(
          ([_, point]) =>
            point.count / agents.length >= this.config.minConsensusThreshold
        )
        .map(([point]) => point),
    };
  }

  private async finalizeDecisions(sessionId: string, roundResult: any) {
    const session = this.activeSessions.get(sessionId)!;
    const decisions = await this.synthesizeDecisions(session, roundResult);

    // Update session with final decisions
    session.decisions = decisions;
    session.status = "implementing";

    // Store decisions in vector store for future reference
    await this.storeDecisions(sessionId, decisions);

    // Notify all agents of final decisions
    await this.notifyAgentsOfDecisions(session, decisions);

    // Create implementation plan
    await this.generateImplementationPlan(decisions);
  }

  private async synthesizeDecisions(
    session: CollaborationSession,
    roundResult: any
  ): Promise<CollaborationSession["decisions"]> {
    const leadAgent = getAgent(session.agents[0])!;

    const decisions = await Promise.all(
      roundResult.consensusPoints.map(async (point: string) => ({
        description: point,
        proposedBy: leadAgent.id,
        supportedBy: session.agents,
        priority: this.calculatePriority(point, session),
        impact: await this.estimateImpact(point, session),
        implementation: await this.generateImplementationPlan(point),
        status: "proposed" as const,
        timestamp: Date.now(),
      }))
    );

    return _.orderBy(decisions, ["priority"], ["desc"]);
  }

  private calculatePriority(
    decision: string,
    session: CollaborationSession
  ): number {
    const urgencyIndicators = [
      "immediate",
      "urgent",
      "critical",
      "emergency",
      "crucial",
    ];

    const hasUrgencyTerms = urgencyIndicators.some((term) =>
      decision.toLowerCase().includes(term)
    );

    const mentionCount = session.messages.filter((msg) =>
      msg.content.toLowerCase().includes(decision.toLowerCase())
    ).length;

    const supportLevel = session.agents.length / session.messages.length;

    return (
      (hasUrgencyTerms ? 0.5 : 0) +
      (mentionCount / session.messages.length) * 0.3 +
      supportLevel * 0.2
    );
  }

  private async estimateImpact(
    decision: string,
    session: CollaborationSession
  ) {
    // Use vector similarity to find similar past decisions and their impacts
    const embedding = await this.vectorStore.createEmbedding(decision);
    const similarDecisions = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "collaboration_decision" },
        timestamp: { $gt: Date.now() - 24 * 60 * 60 * 1000 },
      },
      topK: 5,
    });

    const impacts = similarDecisions.matches.map(
      (match: any) => match.metadata.impact
    );

    if (impacts.length > 0) {
      return {
        environmental: _.meanBy(impacts, "environmental"),
        social: _.meanBy(impacts, "social"),
        economic: _.meanBy(impacts, "economic"),
      };
    }

    // Fallback to content analysis if no historical data
    return this.analyzeDecisionContent(decision);
  }

  private async generateImplementationPlan(
    input: string | CollaborationSession["decisions"]
  ): Promise<{
    steps: string[];
    timeline: number;
    resources: string[];
  }> {
    if (typeof input === "string") {
      return {
        steps: await this.generateImplementationSteps(input),
        timeline: this.estimateImplementationTimeline(input),
        resources: await this.identifyRequiredResources(input),
      };
    }

    // Handle array of decisions
    const combinedPlan = await Promise.all(
      input.map(async (decision) => ({
        steps: await this.generateImplementationSteps(decision.description),
        timeline: this.estimateImplementationTimeline(decision.description),
        resources: await this.identifyRequiredResources(decision.description),
      }))
    );

    return {
      steps: combinedPlan.flatMap((p) => p.steps),
      timeline: Math.max(...combinedPlan.map((p) => p.timeline)),
      resources: [...new Set(combinedPlan.flatMap((p) => p.resources))],
    };
  }

  private async handleNoConsensus(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;

    // Analyze points of disagreement
    const disagreements = await this.analyzeDisagreements(session);

    // Try to find compromise solutions
    const compromiseProposals = await this.generateCompromiseProposals(
      disagreements
    );

    if (compromiseProposals.length > 0) {
      // Initiate rapid consensus round with compromise proposals
      await this.conductRapidConsensusRound(sessionId, compromiseProposals);
    } else {
      // Escalate to emergency protocol if no compromise is possible
      await this.escalateToEmergencyProtocol(sessionId);
    }
  }

  private async handleDiscussionError(sessionId: string, error: any) {
    const session = this.activeSessions.get(sessionId)!;

    console.error(`Error in collaboration session ${sessionId}:`, error);

    session.status = "failed";
    session.history.push({
      action: "error_occurred",
      timestamp: Date.now(),
      details: { error: error.message },
    });

    // Notify agents of failure
    await Promise.all(
      session.agents.map((agentId) =>
        this.notifyAgentOfFailure(agentId, sessionId, error)
      )
    );

    this.emit("collaborationError", {
      sessionId,
      error,
      timestamp: Date.now(),
    });
  }

  private async getCityContext() {
    return {
      weather: await this.cityService.getCurrentWeather(),
      mood: await this.cityService.getCityMood(),
    };
  }

  private async storeSessionContext(sessionId: string, event: CityEvent) {
    await this.vectorStore.upsert({
      id: `collab-context-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `${event.title} ${event.description} ${event.category}`
      ),
      metadata: {
        type: "collaboration",
        subtype: "context",
        agentId: event.requiredAgents[0],
        conversationId: sessionId,
        timestamp: Date.now(),
      },
    });
  }

  private async buildCollaborationPrompt(
    agent: Agent,
    event: CityEvent,
    previousMessages: Array<{ agentId: string; content: string }>,
    cityContext: { weather: WeatherState; mood: CityMood },
    round: number
  ): Promise<string> {
    const messageHistory = this.formatMessageHistory(previousMessages);
    const contextInfo = this.formatContextInfo(cityContext);
    const roundGuidance = this.getRoundGuidance(round);

    // Include cultural and memory context
    const culturalContext = await this.formatCulturalContext(
      event.affectedDistricts[0]
    );
    const relevantMemories = await this.formatRelevantMemories(event);

    return `You are ${agent.name}, ${agent.personality}.

Current Event:
Title: ${event.title}
Description: ${event.description}
Category: ${event.category}
Urgency: ${event.urgency}
Impact: Environmental (${event.impact.environmental}), Social (${
      event.impact.social
    }), Economic (${event.impact.economic})

${contextInfo}

Cultural Context:
${culturalContext}

Relevant City Memories:
${relevantMemories}

Previous Discussion:
${messageHistory}

Round ${round + 1} Guidance:
${roundGuidance}

Based on your expertise and role, provide your assessment and recommendations.
Consider:
1. How this aligns with your area of expertise
2. Potential collaboration points with other involved agents
3. Specific actions you recommend
4. Any concerns or considerations from your perspective
5. How current city conditions might affect your approach
6. Build upon or respectfully challenge previous suggestions
7. Consider long-term implications and sustainability
8. How this aligns with cultural values and historical context
9. Impact on community memory and cultural significance

Respond in a professional but conversational tone, addressing other agents by name when relevant.`;
  }

  private getRoundGuidance(round: number): string {
    const guidances = [
      "Focus on initial assessment and identifying key challenges.",
      "Build upon previous suggestions and address any concerns raised.",
      "Work towards concrete solutions and implementation details.",
      "Focus on consensus-building and addressing remaining disagreements.",
      "Finalize decisions and establish clear action items.",
    ];

    return (
      guidances[round] || "Focus on reaching final consensus and action items."
    );
  }

  async addMessage(sessionId: string, agentId: string, content: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    const sentiment = await this.analyzeSentiment(content);
    const topics = await this.extractTopics(content);

    const message = {
      agentId,
      content,
      timestamp: Date.now(),
      sentiment,
      topics,
    };

    session.messages.push(message);
    await this.updateParticipationMetrics(sessionId, agentId);

    // Store message in vector store for context analysis
    await this.vectorStore.upsert({
      id: `collab-message-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(content),
      metadata: {
        type: "collaboration",
        subtype: "message",
        agentId,
        sentiment: sentiment?.toString(),
        timestamp: message.timestamp,
      },
    });

    this.emit("messageAdded", {
      sessionId,
      agentId,
      message,
    });
  }

  private async updateParticipationMetrics(sessionId: string, agentId: string) {
    const session = this.activeSessions.get(sessionId)!;

    // Calculate participation score based on message frequency and quality
    const agentMessages = session.messages.filter((m) => m.agentId === agentId);
    const totalMessages = session.messages.length;

    const quantityScore =
      agentMessages.length / Math.max(totalMessages / session.agents.length, 1);
    const qualityScore = _.meanBy(agentMessages, (msg) => msg.sentiment || 0.5);

    session.metrics.participationScore[agentId] =
      quantityScore * 0.4 + qualityScore * 0.6;
  }

  private async analyzeSentiment(content: string): Promise<number> {
    // Analyze sentiment using key phrases and patterns
    const positivePatterns = [
      /agree|support|approve|excellent|good idea/i,
      /beneficial|effective|efficient|valuable/i,
      /collaborate|synergy|together|partnership/i,
    ];

    const negativePatterns = [
      /disagree|oppose|reject|concern|worried/i,
      /ineffective|inefficient|problematic|costly/i,
      /risk|danger|threat|failure/i,
    ];

    let score = 0.5; // Neutral baseline

    positivePatterns.forEach((pattern) => {
      if (pattern.test(content)) score += 0.1;
    });

    negativePatterns.forEach((pattern) => {
      if (pattern.test(content)) score -= 0.1;
    });

    return Math.max(0, Math.min(1, score));
  }

  private async monitorActiveSessions() {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      try {
        await this.updateSessionMetrics(sessionId);
        await this.checkSessionProgress(sessionId);
      } catch (error) {
        console.error(`Error monitoring session ${sessionId}:`, error);
      }
    }
  }
  private async updateSessionMetrics(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;
    const metrics = await this.calculateSessionMetrics(session);
    session.metrics = metrics;
  }

  private async calculateSessionMetrics(session: CollaborationSession) {
    const consensusTracker = new Map<string, ConsensusPoint>();

    await Promise.all(
      session.messages.map(async (msg) => {
        const points = await this.extractKeyPoints(msg.content);
        points.forEach((point) => {
          const existing = consensusTracker.get(point) || {
            count: 0,
            supporters: [],
          };
          consensusTracker.set(point, {
            count: existing.count + 1,
            supporters: [...existing.supporters, msg.agentId],
          });
        });
      })
    );

    return {
      consensusLevel: this.calculateConsensusLevel(
        consensusTracker,
        session.agents.length
      ),
      progressRate: this.calculateProgressRate(session),
      effectiveness: this.calculateEffectiveness(session),
      participationScore: this.calculateParticipationScores(session),
    };
  }

  private async checkSessionProgress(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;
    if (
      session.metrics.progressRate < 0.2 &&
      Date.now() - session.messages[0]?.timestamp >
        this.config.decisionTimeoutMs
    ) {
      await this.handleStaleSession(sessionId);
    }
  }

  private async extractKeyPoints(content: string): Promise<string[]> {
    const lines = content.split("\n");
    return lines
      .filter(
        (line) => line.trim().startsWith("-") || line.trim().startsWith("*")
      )
      .map((line) => line.replace(/^[-*]\s*/, "").trim());
  }

  private calculateConsensusLevel(
    consensusTracker: Map<string, ConsensusPoint>,
    totalAgents: number
  ): number {
    const uniquePoints = new Set<string>();
    const pointFrequency = new Map<string, number>();

    consensusTracker.forEach((point, key) => {
      uniquePoints.add(key);
      pointFrequency.set(key, point.count);
    });

    const consensusPoints = Array.from(pointFrequency.values()).filter(
      (frequency) => frequency / totalAgents > this.config.minConsensusThreshold
    ).length;

    return consensusPoints / uniquePoints.size;
  }

  private async checkForEmergencyAction(
    event: CityEvent,
    responses: Map<string, string>
  ): Promise<boolean> {
    const urgencyIndicators = [
      "immediate",
      "critical",
      "emergency",
      "urgent",
      "severe",
    ];
    const hasUrgentTerms = Array.from(responses.values()).some((response) =>
      urgencyIndicators.some((term) => response.toLowerCase().includes(term))
    );

    return (
      hasUrgentTerms && event.urgency > this.config.emergencyProtocolThreshold
    );
  }

  private async storeDecisions(
    sessionId: string,
    decisions: CollaborationSession["decisions"]
  ) {
    const metadata: VectorMetadata = {
      type: "district",
      sessionId,
      decisions: JSON.stringify(decisions),
      timestamp: Date.now(),
    };

    await this.vectorStore.upsert({
      id: `decisions-${sessionId}`,
      values: await this.vectorStore.createEmbedding(JSON.stringify(decisions)),
      metadata,
    });
  }

  private async notifyAgentsOfDecisions(
    session: CollaborationSession,
    decisions: CollaborationSession["decisions"]
  ) {
    const notification = this.formatDecisionNotification(decisions);
    for (const agentId of session.agents) {
      await this.addMessage(
        session.eventId,
        "system",
        `@${agentId} ${notification}`
      );
    }
  }

  private formatDecisionNotification(
    decisions: CollaborationSession["decisions"]
  ): string {
    return `Final Decisions:\n${decisions
      .map((d) => `- ${d.description} (Priority: ${d.priority})`)
      .join("\n")}`;
  }

  private analyzeDecisionContent(decision: string) {
    const environmentalTerms = [
      "environment",
      "sustainability",
      "green",
      "eco",
    ];
    const socialTerms = ["community", "social", "public", "citizens"];
    const economicTerms = ["economic", "financial", "cost", "budget"];

    return {
      environmental: environmentalTerms.some((term) =>
        decision.toLowerCase().includes(term)
      )
        ? 0.8
        : 0.2,
      social: socialTerms.some((term) => decision.toLowerCase().includes(term))
        ? 0.8
        : 0.2,
      economic: economicTerms.some((term) =>
        decision.toLowerCase().includes(term)
      )
        ? 0.8
        : 0.2,
    };
  }

  private async generateImplementationSteps(
    decision: string
  ): Promise<string[]> {
    const systemPrompt = `Generate implementation steps for: ${decision}`;
    const response = await this.togetherService.generateText(systemPrompt);
    return response.split("\n").filter((step) => step.trim().length > 0);
  }

  private estimateImplementationTimeline(decision: string): number {
    const complexityIndicators = [
      "complex",
      "multiple",
      "long-term",
      "extensive",
    ];
    const isComplex = complexityIndicators.some((indicator) =>
      decision.toLowerCase().includes(indicator)
    );
    return isComplex ? 30 : 14; // Days
  }

  private async identifyRequiredResources(decision: string): Promise<string[]> {
    const systemPrompt = `List required resources for: ${decision}`;
    const response = await this.togetherService.generateText(systemPrompt);
    return response
      .split("\n")
      .filter((resource) => resource.trim().length > 0);
  }

  private async analyzeDisagreements(session: CollaborationSession) {
    const messagesByAgent = new Map<string, string[]>();
    session.messages.forEach((msg) => {
      const agentMessages = messagesByAgent.get(msg.agentId) || [];
      agentMessages.push(msg.content);
      messagesByAgent.set(msg.agentId, agentMessages);
    });

    return this.findConflictingPoints(messagesByAgent);
  }

  private findConflictingPoints(
    messagesByAgent: Map<string, string[]>
  ): ConflictPoint[] {
    const conflicts: ConflictPoint[] = [];
    // Implementation
    return conflicts;
  }

  private async generateCompromiseProposals(disagreements: ConflictPoint[]) {
    const proposals = await Promise.all(
      disagreements.map((d) => this.generateCompromiseForDisagreement(d))
    );
    return proposals.filter((p) => p !== null);
  }

  private async generateCompromiseForDisagreement(disagreement: {
    topic: string;
    positions: Map<string, string>;
  }) {
    const systemPrompt = `Generate a compromise proposal for differing positions on: ${disagreement.topic}`;
    return await this.togetherService.generateText(systemPrompt);
  }

  private async conductRapidConsensusRound(
    sessionId: string,
    proposals: string[]
  ) {
    const session = this.activeSessions.get(sessionId)!;
    for (const proposal of proposals) {
      await this.addMessage(
        sessionId,
        "system",
        `RAPID CONSENSUS REQUIRED: Please indicate your position on the following proposal:\n${proposal}`
      );
    }
  }

  private async escalateToEmergencyProtocol(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;
    const leadAgent = getAgent(session.agents[0])!;

    await this.addMessage(
      sessionId,
      "system",
      "EMERGENCY PROTOCOL ACTIVATED: Lead agent will make final decision due to time constraints."
    );

    const finalDecision = await this.generateEmergencyDecision(
      session,
      leadAgent
    );
    session.decisions.push(finalDecision);
  }

  private async generateEmergencyDecision(
    session: CollaborationSession,
    leadAgent: Agent
  ) {
    const systemPrompt = `As ${leadAgent.name}, make an emergency decision based on the current situation.`;
    const decision = await this.togetherService.generateText(systemPrompt);

    return {
      description: decision,
      proposedBy: leadAgent.id,
      supportedBy: [leadAgent.id],
      priority: 1,
      impact: this.analyzeDecisionContent(decision),
      implementation: await this.generateImplementationPlan(decision),
      status: "approved" as const,
      timestamp: Date.now(),
    };
  }

  private async notifyAgentOfFailure(
    agentId: string,
    sessionId: string,
    error: any
  ) {
    const errorMessage = `Collaboration session ${sessionId} has encountered an error: ${error.message}`;
    await this.addMessage(sessionId, "system", `@${agentId} ${errorMessage}`);
  }

  private formatMessageHistory(
    messages: Array<{ agentId: string; content: string }>
  ) {
    return messages
      .map((msg) => {
        const agent = getAgent(msg.agentId)!;
        return `${agent.name}: ${msg.content}`;
      })
      .join("\n");
  }

  private formatContextInfo(cityContext: {
    weather: WeatherState;
    mood: CityMood;
  }) {
    return `Current City Context:
- Weather: ${cityContext.weather.condition}, ${
      cityContext.weather.temperature
    }°C
- City Mood: ${
      cityContext.mood.dominantEmotion
    } (${cityContext.mood.overall.toFixed(2)})
- Community Status: ${cityContext.mood.factors.community.toFixed(2)}
- Stress Level: ${cityContext.mood.factors.stress.toFixed(2)}`;
  }

  private async extractTopics(content: string): Promise<string[]> {
    const topics = new Set<string>();

    // Domain-specific topic patterns
    const topicPatterns: Record<string, RegExp> = {
      infrastructure: /infrastructure|building|construction|maintenance/i,
      environment: /environmental|sustainability|green|pollution/i,
      social: /community|social|public|citizens/i,
      economic: /economic|financial|budget|cost/i,
      emergency: /emergency|urgent|critical|immediate/i,
      technology: /technology|digital|smart|system/i,
    };

    Object.entries(topicPatterns).forEach(([topic, pattern]) => {
      if (pattern.test(content)) {
        topics.add(topic);
      }
    });

    return Array.from(topics);
  }

  private async findSimilarSession(event: CityEvent): Promise<string | null> {
    const embedding = await this.vectorStore.createEmbedding(
      `${event.title} ${event.description} ${event.category}`
    );

    const similarSessions = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "collaboration_context" },
        timestamp: { $gt: Date.now() - 24 * 60 * 60 * 1000 }, // Last 24 hours
      },
      topK: 1,
    });

    if (
      similarSessions.matches.length > 0 &&
      similarSessions.matches[0].score > 0.85
    ) {
      return similarSessions.matches[0].metadata.sessionId;
    }

    return null;
  }

  private async mergeWithExistingSession(
    existingSessionId: string,
    newEvent: CityEvent
  ): Promise<string> {
    const existingSession = this.activeSessions.get(existingSessionId)!;

    // Merge agents
    const mergedAgents = new Set([
      ...existingSession.agents,
      ...newEvent.requiredAgents,
    ]);
    existingSession.agents = Array.from(mergedAgents);

    // Add merge event to history
    existingSession.history.push({
      action: "session_merged",
      timestamp: Date.now(),
      details: { mergedEventId: newEvent.id },
    });

    // Notify agents of merger
    await this.notifySessionMerge(existingSessionId, newEvent);

    return existingSessionId;
  }

  private async notifySessionMerge(sessionId: string, newEvent: CityEvent) {
    const session = this.activeSessions.get(sessionId)!;
    const mergeNotification = `This collaboration session has been merged with a related event: ${newEvent.title}. 
    Please consider the additional context in our ongoing discussion.`;
    await this.addMessage(sessionId, "system", mergeNotification);
  }

  private async findDomainExperts(category: string): Promise<string[]> {
    const expertiseMatches = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(category),
      filter: { type: { $eq: "agent_expertise" } },
      topK: 3,
    });

    return expertiseMatches.matches.map(
      (match: { metadata: { agentId: string } }) => match.metadata.agentId
    );
  }

  private async maintainSessions() {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      // Archive completed sessions
      if (session.status === "completed") {
        await this.archiveSession(sessionId);
        this.activeSessions.delete(sessionId);
        continue;
      }

      // Check for stale sessions
      const lastActivity =
        _.maxBy(session.messages, "timestamp")?.timestamp || 0;
      if (Date.now() - lastActivity > 24 * 60 * 60 * 1000) {
        // 24 hours
        await this.handleStaleSession(sessionId);
      }
    }
  }

  private async archiveSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;

    const embedding = await this.vectorStore.createEmbedding(
      JSON.stringify(session.decisions)
    );

    await this.vectorStore.upsert({
      id: `archived-session-${sessionId}`,
      values: embedding,
      metadata: {
        type: "collaboration",
        subtype: "archived",
        sessionId,
        decisions: JSON.stringify(session.decisions),
        metrics: JSON.stringify(session.metrics),
        timestamp: Date.now(),
      },
    });
  }

  private async handleStaleSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;

    // Analyze reason for stalling
    const stallReason = await this.analyzeStallReason(session);

    // Take appropriate action based on reason
    if (stallReason === "lack_of_consensus") {
      await this.escalateToEmergencyProtocol(sessionId);
    } else if (stallReason === "incomplete_information") {
      await this.requestAdditionalInformation(sessionId);
    } else {
      await this.gracefullyCloseSession(sessionId);
    }
  }

  private async analyzeStallReason(
    session: CollaborationSession
  ): Promise<string> {
    const recentMessages = session.messages.slice(-5);
    const sentiments = recentMessages.map((msg) => msg.sentiment || 0.5);
    const avgSentiment = _.mean(sentiments);

    if (avgSentiment < 0.4) return "lack_of_consensus";
    if (
      recentMessages.some((msg) =>
        msg.content.includes("need more information")
      )
    ) {
      return "incomplete_information";
    }
    return "natural_conclusion";
  }

  private async requestAdditionalInformation(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;
    const missingInfo = await this.identifyMissingInformation(session);

    const infoRequest = `Additional information needed:
${missingInfo.join("\n")}
Please provide these details to continue the discussion.`;

    await this.addMessage(sessionId, "system", infoRequest);
  }

  private async identifyMissingInformation(
    session: CollaborationSession
  ): Promise<string[]> {
    const missingInfo = [];
    const content = session.messages.map((m) => m.content).join(" ");

    if (!content.includes("budget") && !content.includes("cost")) {
      missingInfo.push("- Budget/cost estimates");
    }
    if (!content.includes("timeline") && !content.includes("schedule")) {
      missingInfo.push("- Implementation timeline");
    }
    if (!content.includes("risk") && !content.includes("challenge")) {
      missingInfo.push("- Risk assessment");
    }

    return missingInfo;
  }

  private async gracefullyCloseSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;

    // Summarize achievements and remaining tasks
    const summary = await this.generateSessionSummary(session);
    await this.addMessage(sessionId, "system", summary);

    // Create follow-up tasks if needed
    const followupTasks = await this.createFollowupTasks(session);

    // Archive session
    await this.archiveSession(sessionId);
    this.activeSessions.delete(sessionId);

    this.emit("sessionClosed", {
      sessionId,
      summary,
      followupTasks,
    });
  }

  private async generateSessionSummary(
    session: CollaborationSession
  ): Promise<string> {
    const decisions = session.decisions
      .map((d) => `- ${d.description} (${d.status})`)
      .join("\n");

    const participation = Object.entries(session.metrics.participationScore)
      .map(([agentId, score]) => {
        const agent = getAgent(agentId);
        return `${agent?.name}: ${(score * 100).toFixed(1)}%`;
      })
      .join("\n");

    return `Collaboration Session Summary:\n\n${decisions}\n\n${participation}`;
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

  private async handleConflictPoints(points: string[]): Promise<string[]> {
    const resolvedPoints = await Promise.all(
      points.map(async (point: string): Promise<string> => {
        // Implementation
        return point;
      })
    );
    return resolvedPoints;
  }

  private async analyzeDiscussionTopics(session: CollaborationSession) {
    const resolvedTopics = await this.identifyTopics(session);
    for (const topic of resolvedTopics) {
      // Process topics
    }
  }

  private calculateProgressRate(session: CollaborationSession): number {
    return (
      session.decisions.filter((d) => d.status === "completed").length /
      session.decisions.length
    );
  }

  private calculateEffectiveness(session: CollaborationSession): number {
    return (
      session.decisions.reduce((acc, d) => {
        const overall =
          (d.impact.environmental + d.impact.social + d.impact.economic) / 3;
        return acc + overall;
      }, 0) / session.decisions.length
    );
  }

  private calculateParticipationScores(
    session: CollaborationSession
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    session.agents.forEach((agentId) => {
      scores[agentId] = this.calculateAgentParticipation(session, agentId);
    });
    return scores;
  }

  private async createFollowupTasks(
    session: CollaborationSession
  ): Promise<string[]> {
    return session.decisions.map((d) => `Follow up on: ${d.description}`);
  }

  private calculateAgentParticipation(
    session: CollaborationSession,
    agentId: string
  ): number {
    const agentMessages = session.messages.filter((m) => m.agentId === agentId);
    return agentMessages.length / session.messages.length;
  }

  private async identifyTopics(
    session: CollaborationSession
  ): Promise<string[]> {
    const content = session.messages.map((m) => m.content).join(" ");
    // Implementation
    return [];
  }

  async recordAgentInteraction(
    agentId1: string,
    agentId2: string,
    content: string
  ): Promise<any> {
    try {
      const embedding = await this.vectorStore.createEmbedding(content);

      const interactionId = `interaction-${Date.now()}`;
      await this.vectorStore.upsert({
        id: interactionId,
        values: embedding,
        metadata: {
          type: "collaboration",
          agentId1,
          agentId2,
          content,
          timestamp: Date.now(),
        },
      });

      // Emit interaction event
      this.emit("agentInteraction", {
        interactionId,
        agentId1,
        agentId2,
        content,
        timestamp: Date.now(),
      });

      return {
        id: interactionId,
        agentId1,
        agentId2,
        content,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Failed to record agent interaction:", error);
      throw error;
    }
  }

  private async formatCulturalContext(districtId: string): Promise<string> {
    try {
      const embedding = await this.vectorStore.createEmbedding(
        `district ${districtId} cultural context`
      );

      const results = await this.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $eq: "district" },
          subtype: { $eq: "cultural_context" },
          districtId: { $eq: districtId },
        },
        topK: 3,
      });

      if (!results.matches.length)
        return "No specific cultural context available.";

      return results.matches
        .map(
          (match: { metadata: { description: string } }) =>
            match.metadata.description
        )
        .join("\n");
    } catch (error) {
      console.error("Error fetching cultural context:", error);
      return "Cultural context temporarily unavailable.";
    }
  }

  private async formatRelevantMemories(event: CityEvent): Promise<string> {
    try {
      const embedding = await this.vectorStore.createEmbedding(
        `${event.title} ${event.description}`
      );

      const results = await this.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $eq: "district" },
          subtype: { $eq: "collective_memory" },
          districtId: { $in: event.affectedDistricts },
        },
        topK: 3,
      });

      if (!results.matches.length)
        return "No relevant historical memories found.";

      return results.matches
        .map(
          (match: { metadata: { description: string; impact: number } }) =>
            `- ${match.metadata.description} (Impact: ${match.metadata.impact})`
        )
        .join("\n");
    } catch (error) {
      console.error("Error fetching relevant memories:", error);
      return "Historical memories temporarily unavailable.";
    }
  }
}
