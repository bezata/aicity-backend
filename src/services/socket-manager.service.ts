import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { AgentCollaborationService } from "./agent-collaboration.service";
import { CityEvent } from "../types/city-events";
import { getAgent } from "../config/city-agents";
import { EventBus } from "./event-bus.service";

interface WebSocketConnection extends WebSocket {
  sessionId?: string;
  agentId?: string;
  district?: string;
  lastActivity?: number;
}

interface BroadcastOptions {
  excludeSession?: string;
  targetDistrict?: string;
  priority?: "low" | "medium" | "high" | "critical";
}

export class SocketManagerService extends EventEmitter {
  private connections: Map<string, Set<WebSocketConnection>> = new Map();
  private readonly eventBus: EventBus;
  private heartbeatInterval!: NodeJS.Timer;

  constructor(private collaborationService: AgentCollaborationService) {
    super();
    this.eventBus = EventBus.getInstance();
    this.setupCollaborationListeners();
    this.setupEventBusListeners();
    this.initializeHeartbeat();
  }

  private setupCollaborationListeners() {
    this.collaborationService.on("messageAdded", (data) => {
      this.broadcastToSession(data.sessionId, {
        type: "agentMessage",
        data: {
          agent: getAgent(data.agentId),
          content: data.content,
          timestamp: Date.now(),
          priority: this.determineMessagePriority(data.content),
        },
      });
    });

    this.collaborationService.on("decisionsReached", (data) => {
      this.broadcastToSession(data.sessionId, {
        type: "decisions",
        data: {
          decisions: data.decisions,
          agents: data.agents.map((id: string) => getAgent(id)),
          impact: this.calculateDecisionImpact(data.decisions),
          timestamp: Date.now(),
        },
      });
    });

    this.collaborationService.on("aiAnalysisComplete", (data) => {
      this.broadcastToSession(data.sessionId, {
        type: "aiAnalysis",
        data: {
          analysis: data.analysis,
          recommendations: data.recommendations,
          confidence: data.confidence,
          timestamp: Date.now(),
        },
      });
    });
  }

  private setupEventBusListeners() {
    this.eventBus.on("emergencyAlert", (alert) => {
      this.broadcastToAll(
        {
          type: "emergency",
          data: alert,
        },
        { priority: "critical" }
      );
    });

    this.eventBus.on("cityMetricsUpdate", (metrics) => {
      this.broadcastToAll(
        {
          type: "metrics",
          data: metrics,
        },
        { priority: "low" }
      );
    });

    this.eventBus.on("districtEvent", (event) => {
      this.broadcastToAll(
        {
          type: "districtUpdate",
          data: event,
        },
        { targetDistrict: event.districtId }
      );
    });
  }

  handleConnection(
    ws: WebSocketConnection,
    sessionId: string,
    agentId?: string,
    district?: string
  ) {
    ws.sessionId = sessionId;
    ws.agentId = agentId;
    ws.district = district;
    ws.lastActivity = Date.now();

    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }

    this.connections.get(sessionId)!.add(ws);

    // Send initial state
    ws.send(
      JSON.stringify({
        type: "connected",
        data: {
          message: `Connected to collaboration session ${sessionId}`,
          sessionId,
          agentId,
          district,
          timestamp: Date.now(),
        },
      })
    );

    // Setup message handler
    ws.on("message", (message: string) => this.handleMessage(ws, message));

    // Setup close handler
    ws.on("close", () => {
      this.handleDisconnection(ws);
    });

    // Setup error handler
    ws.on("error", (error) => {
      this.handleError(ws, error);
    });

    // Notify about new connection
    this.emit("connectionEstablished", {
      sessionId,
      agentId,
      district,
      timestamp: Date.now(),
    });
  }

  private handleMessage(ws: WebSocketConnection, message: string) {
    try {
      const data = JSON.parse(message);
      ws.lastActivity = Date.now();

      switch (data.type) {
        case "heartbeat":
          this.handleHeartbeat(ws);
          break;
        case "agentAction":
          this.handleAgentAction(ws, data);
          break;
        case "districtUpdate":
          this.handleDistrictUpdate(ws, data);
          break;
        default:
          this.emit("messageReceived", {
            sessionId: ws.sessionId,
            agentId: ws.agentId,
            data,
            timestamp: Date.now(),
          });
      }
    } catch (error) {
      this.handleError(ws, error);
    }
  }

  private handleDisconnection(ws: WebSocketConnection) {
    if (ws.sessionId) {
      this.connections.get(ws.sessionId)?.delete(ws);
      this.emit("connectionClosed", {
        sessionId: ws.sessionId,
        agentId: ws.agentId,
        district: ws.district,
        timestamp: Date.now(),
      });
    }
  }

  private handleError(ws: WebSocketConnection, error: any) {
    this.emit("connectionError", {
      sessionId: ws.sessionId,
      agentId: ws.agentId,
      error: error.message,
      timestamp: Date.now(),
    });
  }

  private broadcastToAll(message: any, options: BroadcastOptions = {}) {
    const messageStr = JSON.stringify({
      ...message,
      priority: options.priority || "medium",
      timestamp: Date.now(),
    });

    for (const connections of this.connections.values()) {
      for (const client of connections) {
        if (this.shouldSendToClient(client, options)) {
          client.send(messageStr);
        }
      }
    }
  }

  private broadcastToSession(
    sessionId: string,
    message: any,
    options: BroadcastOptions = {}
  ) {
    const connections = this.connections.get(sessionId);
    if (!connections) return;

    const messageStr = JSON.stringify({
      ...message,
      priority: options.priority || "medium",
      timestamp: Date.now(),
    });

    for (const client of connections) {
      if (this.shouldSendToClient(client, options)) {
        client.send(messageStr);
      }
    }
  }

  private shouldSendToClient(
    client: WebSocketConnection,
    options: BroadcastOptions
  ): boolean {
    if (client.readyState !== WebSocket.OPEN) return false;
    if (options.excludeSession && client.sessionId === options.excludeSession)
      return false;
    if (options.targetDistrict && client.district !== options.targetDistrict)
      return false;
    return true;
  }

  private determineMessagePriority(content: any): BroadcastOptions["priority"] {
    // Ensure content is a string and not undefined
    const messageContent =
      typeof content === "string"
        ? content
        : content?.message || content?.content || "";

    if (
      messageContent.includes("emergency") ||
      messageContent.includes("critical")
    )
      return "critical";
    if (
      messageContent.includes("important") ||
      messageContent.includes("urgent")
    )
      return "high";
    if (messageContent.includes("update") || messageContent.includes("change"))
      return "medium";
    return "low";
  }

  private calculateDecisionImpact(decisions: any[]) {
    // Placeholder for decision impact calculation
    return {
      socialImpact: 0.7,
      economicImpact: 0.5,
      environmentalImpact: 0.6,
    };
  }

  private initializeHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const connections of this.connections.values()) {
        for (const client of connections) {
          if (now - (client.lastActivity || 0) > 30000) {
            // 30 seconds
            client.ping();
          }
        }
      }
    }, 15000); // Every 15 seconds
  }

  private handleHeartbeat(ws: WebSocketConnection) {
    ws.lastActivity = Date.now();
    ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
  }

  private handleAgentAction(ws: WebSocketConnection, data: any) {
    this.eventBus.emit("agentAction", {
      sessionId: ws.sessionId,
      agentId: ws.agentId,
      action: data.action,
      timestamp: Date.now(),
    });
  }

  private handleDistrictUpdate(ws: WebSocketConnection, data: any) {
    this.eventBus.emit("districtUpdate", {
      district: ws.district,
      update: data.update,
      timestamp: Date.now(),
    });
  }
}
