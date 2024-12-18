import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import { CityEvent } from "../types/city-events";
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { getAgent } from "../config/city-agents";
import { CityService } from "./city.service";
import type { WeatherState, CityMood } from "../types/city.types";
import { Message } from "../types/conversation.types";

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

interface CollaborationMessage {
  id: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant";
}

export class AgentCollaborationService extends EventEmitter {
  private activeSessions: Map<string, CollaborationSession> = new Map();

  constructor(
    private togetherService: TogetherService,
    private vectorStore: VectorStoreService,
    private cityService: CityService
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

    // Validate that all required agents exist
    const agents = session.agents
      .map((id) => getAgent(id))
      .filter((agent): agent is Agent => agent !== undefined);

    if (agents.length === 0) {
      throw new Error("No valid agents found for collaboration");
    }

    const leadAgent = agents[0];
    const cityContext = {
      weather: await this.cityService.getCurrentWeather(),
      mood: await this.cityService.getCityMood(),
    };

    // Generate initial assessment from lead agent
    const initialPrompt = this.buildCollaborationPrompt(
      leadAgent,
      event,
      [],
      cityContext
    );
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
        session.messages,
        cityContext
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
    previousMessages: Array<{ agentId: string; content: string }>,
    cityContext?: {
      weather: WeatherState;
      mood: CityMood;
    }
  ): string {
    const messageHistory = previousMessages
      .map((msg) => {
        const speaker = getAgent(msg.agentId)!;
        return `${speaker.name}: ${msg.content}`;
      })
      .join("\n");

    const contextInfo = cityContext
      ? `
Current City Context:
- Weather: ${cityContext.weather.condition}, ${
          cityContext.weather.temperature
        }°C
- City Mood: ${
          cityContext.mood.dominantEmotion
        } (${cityContext.mood.overall.toFixed(2)})
- Community Status: ${cityContext.mood.factors.community.toFixed(2)}
- Stress Level: ${cityContext.mood.factors.stress.toFixed(2)}`
      : "";

    return `You are ${agent.name}, ${agent.personality}.
    
Current Event:
Title: ${event.title}
Description: ${event.description}
Category: ${event.category}
Urgency: ${event.urgency}
Impact: Environmental (${event.impact.environmental}), Social (${event.impact.social}), Economic (${event.impact.economic})
${contextInfo}

Previous Discussion:
${messageHistory}

Based on your expertise and role, provide your assessment and recommendations. 
Consider:
1. How this aligns with your area of expertise
2. Potential collaboration points with other involved agents
3. Specific actions you recommend
4. Any concerns or considerations from your perspective
5. How current city conditions might affect your approach

Respond in a professional but conversational tone, addressing other agents by name when relevant.`;
  }

  private async synthesizeDecisions(sessionId: string) {
    const session = this.activeSessions.get(sessionId)!;
    const messages: Message[] = session.messages.map((msg) => ({
      id: crypto.randomUUID(),
      agentId: msg.agentId,
      content: msg.content,
      timestamp: msg.timestamp,
      role: "assistant",
    }));

    // Get valid agents
    const agents = session.agents
      .map((id) => getAgent(id))
      .filter((agent): agent is Agent => agent !== undefined);

    if (agents.length === 0) {
      throw new Error("No valid agents found for synthesis");
    }

    // Generate synthesis from lead agent
    const leadAgent = agents[0];
    const synthesis = await this.togetherService.generateResponse(
      leadAgent,
      messages,
      this.buildSynthesisPrompt(session)
    );

    // Store decisions
    const decisions = this.extractDecisions(synthesis, session);
    session.decisions = decisions;

    // Store in vector store
    await this.vectorStore.upsert({
      id: `collab-${sessionId}`,
      values: await this.togetherService.createEmbedding(synthesis),
      metadata: {
        type: "collaboration",
        eventId: session.eventId,
        agents: session.agents,
        decisions: JSON.stringify(decisions),
        status: session.status,
      },
    });
  }

  private buildSynthesisPrompt(session: CollaborationSession): string {
    return `Based on the discussion:
${session.messages
  .map((msg) => `${getAgent(msg.agentId)!.name}: ${msg.content}`)
  .join("\n")}

Synthesize the key decisions and action items discussed.`;
  }

  private extractDecisions(
    synthesis: string,
    session: CollaborationSession
  ): Array<{
    description: string;
    proposedBy: string;
    supportedBy: string[];
    timestamp: number;
  }> {
    return synthesis
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((decision) => ({
        description: decision.substring(1).trim(),
        proposedBy: getAgent(session.agents[0])!.id,
        supportedBy: session.agents,
        timestamp: Date.now(),
      }));
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
