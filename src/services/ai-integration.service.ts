import { VectorStoreService } from "./vector-store.service";
import {
  SystemInitializationConfig,
  SystemInitializationResult,
  NetworkStatus,
  AIDecisionContext,
  AIPattern,
  AIProtocol,
  ProtocolMetadata,
  StateMetadata,
  DecisionMetadata,
  PatternMetadata,
  Metadata,
  isDecisionMetadata,
  isPatternMetadata,
  QueryMatch,
  RecordMetadata,
} from "../types/ai-integration.types";
import { v4 as uuidv4 } from "uuid";

export class AIIntegrationService {
  private activeAgents: Set<string> = new Set();
  private systemId: string | null = null;
  private networkStatus: NetworkStatus | null = null;
  private decisionHistory: Map<string, AIDecisionContext> = new Map();
  private patterns: Map<string, AIPattern> = new Map();
  private protocols: Map<string, AIProtocol> = new Map();

  constructor(private vectorStore: VectorStoreService) {}

  async initializeSystem(
    config: SystemInitializationConfig
  ): Promise<SystemInitializationResult> {
    try {
      // Generate a unique system ID
      this.systemId = uuidv4();

      // Register agents in the system
      this.activeAgents = new Set(config.agents);

      // Initialize network status
      this.networkStatus = {
        isActive: true,
        connectedAgents: this.activeAgents.size,
        protocol: config.protocol,
        timestamp: Date.now(),
      };

      // Store initial protocol configuration
      const protocolMetadata: ProtocolMetadata = {
        type: "protocol",
        protocol: config.protocol,
        timestamp: Date.now(),
      };

      const protocolVector = await this.vectorStore.createEmbedding(
        JSON.stringify(config.protocol)
      );

      await this.vectorStore.upsert({
        id: `protocol:${this.systemId}`,
        values: protocolVector,
        metadata: protocolMetadata as any,
      });

      // Store initial state if provided
      if (config.initialState) {
        const stateMetadata: StateMetadata = {
          type: "state",
          state: config.initialState,
          timestamp: Date.now(),
        };

        const stateVector = await this.vectorStore.createEmbedding(
          JSON.stringify(config.initialState)
        );

        await this.vectorStore.upsert({
          id: `state:${this.systemId}`,
          values: stateVector,
          metadata: stateMetadata as any,
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

    const decisionContext: AIDecisionContext = {
      agentId,
      decision,
      context,
      timestamp: Date.now(),
    };

    const decisionId = `decision:${this.systemId}:${agentId}:${Date.now()}`;
    this.decisionHistory.set(decisionId, decisionContext);

    const decisionMetadata: DecisionMetadata = {
      type: "decision",
      agentId,
      state: {
        decision,
        context,
      },
      timestamp: Date.now(),
    };

    const decisionVector = await this.vectorStore.createEmbedding(
      JSON.stringify({ decision, context })
    );

    await this.vectorStore.upsert({
      id: decisionId,
      values: decisionVector,
      metadata: decisionMetadata as any,
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
        type: { $eq: "decision" },
      },
      topK: limit,
    });

    if (!results.matches) return [];

    return results.matches
      .filter((result: QueryMatch) => isDecisionMetadata(result.metadata))
      .map((result: QueryMatch) => {
        const metadata = result.metadata as DecisionMetadata;
        const state = metadata.state || { decision: "", context: {} };
        return {
          agentId: metadata.agentId,
          decision: state.decision,
          context: state.context,
          timestamp: metadata.timestamp,
        };
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

    const patternMetadata: PatternMetadata = {
      type: "pattern",
      state: {
        pattern,
        context,
        confidence,
      },
      timestamp: Date.now(),
    };

    const patternVector = await this.vectorStore.createEmbedding(pattern);

    await this.vectorStore.upsert({
      id: patternId,
      values: patternVector,
      metadata: patternMetadata as any,
    });
  }

  async findSimilarPatterns(content: string, limit = 5): Promise<AIPattern[]> {
    const vector = await this.vectorStore.createEmbedding(content);

    const results = await this.vectorStore.query({
      vector,
      filter: {
        type: { $eq: "pattern" },
      },
      topK: limit,
    });

    if (!results.matches) return [];

    return results.matches
      .filter((result: QueryMatch) => isPatternMetadata(result.metadata))
      .map((result: QueryMatch) => {
        const metadata = result.metadata as PatternMetadata;
        const state = metadata.state || {
          pattern: "",
          context: {},
          confidence: 0,
        };
        return {
          id: result.id,
          pattern: state.pattern,
          context: state.context,
          confidence: state.confidence,
          timestamp: metadata.timestamp,
        };
      });
  }

  getSystemStatus(): NetworkStatus | null {
    return this.networkStatus;
  }

  isInitialized(): boolean {
    return this.systemId !== null && this.networkStatus !== null;
  }
}
