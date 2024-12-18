import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { AgentCollaborationService } from "./agent-collaboration.service";
import { CityEvent } from "../types/city-events";
import { getAgent } from "../config/city-agents";

interface WebSocketConnection extends WebSocket {
  sessionId?: string;
}

export class SocketManagerService extends EventEmitter {
  private connections: Map<string, Set<WebSocketConnection>> = new Map();

  constructor(private collaborationService: AgentCollaborationService) {
    super();
    this.setupCollaborationListeners();
  }

  private setupCollaborationListeners() {
    this.collaborationService.on("messageAdded", (data) => {
      this.broadcastToSession(data.sessionId, {
        type: "agentMessage",
        data: {
          agent: getAgent(data.agentId),
          content: data.content,
          timestamp: Date.now(),
        },
      });
    });

    this.collaborationService.on("decisionsReached", (data) => {
      this.broadcastToSession(data.sessionId, {
        type: "decisions",
        data: {
          decisions: data.decisions,
          agents: data.agents.map((id: string) => getAgent(id)),
        },
      });
    });
  }

  handleConnection(ws: any, sessionId: string) {
    ws.sessionId = sessionId;

    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }

    this.connections.get(sessionId)!.add(ws);

    ws.send(
      JSON.stringify({
        type: "connected",
        message: `Connected to collaboration session ${sessionId}`,
      })
    );

    ws.on("close", () => {
      this.connections.get(sessionId)?.delete(ws);
    });
  }

  private broadcastToSession(sessionId: string, message: any) {
    const connections = this.connections.get(sessionId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    for (const client of connections) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }
}
