import { EventEmitter } from "events";
import { MetricsService } from "./metrics.service";
import type { ServerWebSocket } from "bun";

interface WebSocketData {
  districtId: string;
  lastActivity: number;
}

export class DistrictWebSocketService extends EventEmitter {
  private connections: Map<string, Set<ServerWebSocket<WebSocketData>>> =
    new Map();
  private heartbeatInterval!: NodeJS.Timer;

  constructor(private metricsService: MetricsService) {
    super();
    this.initializeHeartbeat();
    this.setupMetricsListener();
  }

  private setupMetricsListener() {
    this.metricsService.on("metricsUpdated", (metrics) => {
      for (const [districtId, connections] of this.connections.entries()) {
        const districtMetrics = metrics[districtId];
        if (districtMetrics) {
          this.broadcastToDistrict(districtId, {
            type: "metrics",
            data: districtMetrics,
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  handleConnection(ws: ServerWebSocket<WebSocketData>, districtId: string) {
    ws.data = { districtId, lastActivity: Date.now() };

    if (!this.connections.has(districtId)) {
      this.connections.set(districtId, new Set());
    }

    this.connections.get(districtId)!.add(ws);

    // Send initial state
    this.metricsService.getCurrentMetrics(districtId).then((metrics) => {
      ws.send(
        JSON.stringify({
          type: "initial",
          data: metrics,
          timestamp: Date.now(),
        })
      );
    });
  }

  private handleMessage(ws: ServerWebSocket<WebSocketData>, message: string) {
    try {
      const data = JSON.parse(message);
      ws.data.lastActivity = Date.now();

      switch (data.type) {
        case "heartbeat":
          this.handleHeartbeat(ws);
          break;
        case "subscribe":
          this.handleSubscribe(ws, data);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(ws, data);
          break;
      }
    } catch (error) {
      this.handleError(
        ws,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private handleDisconnection(ws: ServerWebSocket<WebSocketData>) {
    const districtId = ws.data.districtId;
    this.connections.get(districtId)?.delete(ws);
    this.emit("connectionClosed", {
      districtId,
      timestamp: Date.now(),
    });
  }

  private handleError(ws: ServerWebSocket<WebSocketData>, error: Error) {
    this.emit("connectionError", {
      districtId: ws.data.districtId,
      error: error.message,
      timestamp: Date.now(),
    });
  }

  private broadcastToDistrict(districtId: string, message: any) {
    const connections = this.connections.get(districtId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    for (const client of connections) {
      if (client.readyState === 1) {
        // OPEN
        client.send(messageStr);
      }
    }
  }

  private initializeHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const connections of this.connections.values()) {
        for (const client of connections) {
          if (now - client.data.lastActivity > 30000) {
            client.ping();
          }
        }
      }
    }, 15000);
  }

  private handleHeartbeat(ws: ServerWebSocket<WebSocketData>) {
    ws.data.lastActivity = Date.now();
    ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
  }

  private handleSubscribe(ws: ServerWebSocket<WebSocketData>, data: any) {
    // Implementation for metric-specific subscriptions
  }

  private handleUnsubscribe(ws: ServerWebSocket<WebSocketData>, data: any) {
    // Implementation for metric-specific unsubscriptions
  }
}
