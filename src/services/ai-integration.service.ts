import { VectorStoreService, AISystemMetadata } from "./vector-store.service";
import {
  SystemInitializationConfig,
  SystemInitializationResult,
  NetworkStatus,
  AIDecisionContext,
  AIPattern,
  AIProtocol,
} from "../types/ai-integration.types";
import { v4 as uuidv4 } from "uuid";
import { CultureService } from "../services/culture.service";
import { DistrictCultureService } from "../services/district-culture.service";
import { AgentCultureService } from "../services/agent-culture.service";

export class AIIntegrationService {
  private activeAgents: Set<string> = new Set();
  private systemId: string | null = null;
  private networkStatus: NetworkStatus | null = null;
  private decisionHistory: Map<string, AIDecisionContext> = new Map();
  private patterns: Map<string, AIPattern> = new Map();
  private protocols: Map<string, AIProtocol> = new Map();
  private lastHeartbeat: Map<string, number> = new Map();
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(
    private vectorStore: VectorStoreService,
    private cultureService: CultureService,
    private districtCultureService: DistrictCultureService,
    private agentCultureService: AgentCultureService
  ) {
    this.startHeartbeatMonitoring();
  }

  private startHeartbeatMonitoring() {
    setInterval(() => this.checkAgentHeartbeats(), 60 * 1000); // Check every minute
  }

  private checkAgentHeartbeats() {
    const now = Date.now();
    for (const [agentId, lastBeat] of this.lastHeartbeat.entries()) {
      if (now - lastBeat > this.HEARTBEAT_TIMEOUT) {
        this.activeAgents.delete(agentId);
        this.lastHeartbeat.delete(agentId);
        this.updateNetworkStatus();
      }
    }
  }

  private updateNetworkStatus() {
    if (this.networkStatus) {
      this.networkStatus = {
        ...this.networkStatus,
        connectedAgents: this.activeAgents.size,
        timestamp: Date.now(),
      };
    }
  }

  async recordAgentActivity(
    agentId: string,
    activity?: {
      type: string;
      partnerId?: string;
      context?: any;
    }
  ): Promise<void> {
    try {
      const activityData = {
        agentId,
        timestamp: Date.now(),
        ...activity,
      };

      // Store activity in vector store
      await this.vectorStore.upsert({
        id: `agent-activity-${Date.now()}`,
        values: await this.vectorStore.createEmbedding(
          JSON.stringify(activityData)
        ),
        metadata: {
          type: "agent_activity",
          agentId,
          activityType: activity?.type || "registration",
          timestamp: Date.now(),
        },
      });

      // Update agent state in culture service if needed
      if (activity?.type === "conversation_start") {
        await this.agentCultureService.updateAgentInteractions(agentId, {
          type: activity.partnerId || "solo_activity",
          partnerId: activity.partnerId,
          context: activity,
        });
      }
    } catch (error) {
      console.error(`Error recording agent activity for ${agentId}:`, error);
    }
  }

  async initializeSystem(
    config: SystemInitializationConfig
  ): Promise<SystemInitializationResult> {
    try {
      this.systemId = uuidv4();
      this.activeAgents = new Set(config.agents);
      this.networkStatus = {
        isActive: true,
        connectedAgents: this.activeAgents.size,
        protocol: config.protocol,
        timestamp: Date.now(),
      };

      // Store protocol with flat metadata
      const protocolMetadata: Partial<AISystemMetadata> = {
        record_type: "protocol",
        protocol_name: config.protocol.name,
        timestamp: Date.now(),
        system_id: this.systemId,
      };

      const protocolVector = await this.vectorStore.createEmbedding(
        JSON.stringify(config.protocol)
      );

      await this.vectorStore.upsert({
        id: `protocol:${this.systemId}`,
        values: protocolVector,
        metadata: protocolMetadata,
      });

      // Store initial state if provided
      if (config.initialState) {
        const stateMetadata: Partial<AISystemMetadata> = {
          record_type: "state",
          timestamp: Date.now(),
          system_id: this.systemId,
          context_data: JSON.stringify(config.initialState),
        };

        const stateVector = await this.vectorStore.createEmbedding(
          JSON.stringify(config.initialState)
        );

        await this.vectorStore.upsert({
          id: `state:${this.systemId}`,
          values: stateVector,
          metadata: stateMetadata,
        });
      }

      return {
        systemId: this.systemId,
        activeAgents: Array.from(this.activeAgents),
        networkStatus: this.networkStatus,
      };
    } catch (error) {
      throw new Error(
        `Failed to initialize system: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async recordDecision(
    agentId: string,
    decision: string,
    context: Record<string, any>
  ): Promise<void> {
    if (!this.systemId) {
      throw new Error("System not initialized");
    }

    // Record agent activity when they make a decision
    await this.recordAgentActivity(agentId);

    const decisionContext: AIDecisionContext = {
      agentId,
      decision,
      context,
      timestamp: Date.now(),
    };

    const decisionId = `decision:${this.systemId}:${agentId}:${Date.now()}`;
    this.decisionHistory.set(decisionId, decisionContext);

    const decisionMetadata: Partial<AISystemMetadata> = {
      record_type: "decision",
      agent_id: agentId,
      decision_text: decision,
      timestamp: Date.now(),
      system_id: this.systemId,
      context_data: JSON.stringify(context),
    };

    const decisionVector = await this.vectorStore.createEmbedding(
      JSON.stringify({ decision, context })
    );

    await this.vectorStore.upsert({
      id: decisionId,
      values: decisionVector,
      metadata: decisionMetadata,
    });
  }

  async storePattern(
    pattern: string,
    context: Record<string, any>,
    confidence: number
  ): Promise<void> {
    if (!this.systemId) {
      throw new Error("System not initialized");
    }

    const patternId = `pattern:${this.systemId}:${Date.now()}`;
    const aiPattern: AIPattern = {
      id: patternId,
      pattern,
      context,
      confidence,
      timestamp: Date.now(),
    };

    this.patterns.set(patternId, aiPattern);

    const patternMetadata: Partial<AISystemMetadata> = {
      record_type: "pattern",
      pattern_text: pattern,
      confidence: confidence.toString(),
      timestamp: Date.now(),
      system_id: this.systemId,
      context_data: JSON.stringify(context),
    };

    const patternVector = await this.vectorStore.createEmbedding(pattern);

    await this.vectorStore.upsert({
      id: patternId,
      values: patternVector,
      metadata: patternMetadata,
    });
  }

  async findSimilarDecisions(
    content: string,
    limit = 5
  ): Promise<AIDecisionContext[]> {
    const vector = await this.vectorStore.createEmbedding(content);

    const results = await this.vectorStore.query({
      vector,
      filter: {
        record_type: { $eq: "decision" },
      },
      topK: limit,
    });

    if (!results.matches) return [];

    return results.matches.map((result: any) => {
      const metadata = result.metadata as AISystemMetadata;
      const context = metadata.context_data
        ? JSON.parse(metadata.context_data)
        : {};

      return {
        agentId: metadata.agent_id,
        decision: metadata.decision_text,
        context,
        timestamp: metadata.timestamp,
      };
    });
  }

  async findSimilarPatterns(content: string, limit = 5): Promise<AIPattern[]> {
    const vector = await this.vectorStore.createEmbedding(content);

    const results = await this.vectorStore.query({
      vector,
      filter: {
        record_type: { $eq: "pattern" },
      },
      topK: limit,
    });

    if (!results.matches) return [];

    return results.matches.map((result: any) => {
      const metadata = result.metadata as AISystemMetadata;
      const context = metadata.context_data
        ? JSON.parse(metadata.context_data)
        : {};

      return {
        id: result.id,
        pattern: metadata.pattern_text,
        context,
        confidence: parseFloat(metadata.confidence),
        timestamp: metadata.timestamp,
      };
    });
  }

  getSystemStatus(): NetworkStatus | null {
    return this.networkStatus;
  }

  getActiveAgents(): string[] {
    return Array.from(this.activeAgents);
  }

  isInitialized(): boolean {
    return this.systemId !== null && this.networkStatus !== null;
  }
}
