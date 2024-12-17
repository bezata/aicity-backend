import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import { CityEvent } from "../types/city-events";
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { getAgent } from "../config/city-agents";

interface CollaborationSession {
  eventId: string;
  agents: string[];
  status: "planning" | "discussing" | "implementing" | "reviewing";
  messages: Array<{
    agentId: string;
    content: string;
    timestamp: number;
  }>;
  decisions: Array<{
    description: string;
    proposedBy: string;
    supportedBy: string[];
    timestamp: number;
  }>;
}

export class AgentCollaborationService extends EventEmitter {
  private activeSessions: Map<string, CollaborationSession> = new Map();

  constructor(
    private togetherService: TogetherService,
    private vectorStore: VectorStoreService
  ) {
    super();
  }

  async initiateCollaboration(event: CityEvent) {
    const sessionId = `collab-${event.id}`;
    const session: CollaborationSession = {
      eventId: event.id,
      agents: event.requiredAgents,
      status: "planning",
      messages: [],
      decisions: [],
    };

    this.activeSessions.set(sessionId, session);

    // Start the collaboration process
    await this.facilitateDiscussion(sessionId, event);
    return sessionId;
  }

  private async facilitateDiscussion(sessionId: string, event: CityEvent) {
    const session = this.activeSessions.get(sessionId)!;
    const leadAgent = getAgent(session.agents[0])!;

    // Generate initial assessment from lead agent
    const initialPrompt = this.buildCollaborationPrompt(leadAgent, event, []);
    const initialResponse = await this.togetherService.generateResponse(
      leadAgent,
      [],
      initialPrompt
    );

    await this.addMessage(sessionId, leadAgent.id, initialResponse);

    // Get responses from other agents
    for (const agentId of session.agents.slice(1)) {
      const agent = getAgent(agentId)!;
      const agentPrompt = this.buildCollaborationPrompt(
        agent,
        event,
        session.messages
      );
      const response = await this.togetherService.generateResponse(
        agent,
        [],
        agentPrompt
      );
      await this.addMessage(sessionId, agent.id, response);
    }

    // Synthesize decisions
    await this.synthesizeDecisions(sessionId);
  }

  private buildCollaborationPrompt(
    agent: Agent,
    event: CityEvent,
    previousMessages: Array<{ agentId: string; content: string }>
  ): string {
    const messageHistory = previousMessages
      .map((msg) => {
        const speaker = getAgent(msg.agentId)!;
        return `${speaker.name}: ${msg.content}`;
      })
      .join("\n");

    return `You are ${agent.name}, ${agent.personality}.
    
Current Event:
Title: ${event.title}
Description: ${event.description}
Category: ${event.category}
Urgency: ${event.urgency}
Impact: Environmental (${event.impact.environmental}), Social (${event.impact.social}), Economic (${event.impact.economic})

Previous Discussion:
${messageHistory}

Based on your expertise and role, provide your assessment and recommendations. 
Consider:
1. How this aligns with your area of expertise
2. Potential collaboration points with other involved agents
3. Specific actions you recommend
4. Any concerns or considerations from your perspective

Respond in a professional but conversational tone, addressing other agents by name when relevant.`;
  }

  private async synthesizeDecisions(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;
    const leadAgent = getAgent(session.agents[0])!;

    const synthesisPrompt = `Based on the discussion:
${session.messages
  .map((msg) => `${getAgent(msg.agentId)!.name}: ${msg.content}`)
  .join("\n")}

Synthesize the key decisions and action items discussed.`;

    const synthesis = await this.togetherService.generateResponse(
      leadAgent,
      [],
      synthesisPrompt
    );

    // Parse and store decisions
    const decisions = synthesis
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((decision) => ({
        description: decision.substring(1).trim(),
        proposedBy: leadAgent.id,
        supportedBy: session.agents,
        timestamp: Date.now(),
      }));

    session.decisions.push(...decisions);
    session.status = "implementing";

    // Store the collaboration context
    await this.vectorStore.upsert({
      id: `collab-${sessionId}`,
      values: await this.togetherService.createEmbedding(synthesis),
      metadata: {
        type:  "collaboration",
        eventId: session.eventId,
        agents: session.agents,
        decisions: decisions,
        status: session.status,
      },
    });

    this.emit("decisionsReached", {
      sessionId,
      decisions,
      agents: session.agents,
    });
  }

  async addMessage(sessionId: string, agentId: string, content: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    session.messages.push({
      agentId,
      content,
      timestamp: Date.now(),
    });

    this.emit("messageAdded", {
      sessionId,
      agentId,
      content,
    });
  }

  async getSessionStatus(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    return {
      id: sessionId,
      status: session.status,
      agents: session.agents,
      messages: session.messages,
      decisions: session.decisions,
    };
  }
}
