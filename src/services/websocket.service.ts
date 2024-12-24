import { EventEmitter } from "events";
import WebSocket from "ws";

export class WebSocketService extends EventEmitter {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 8080) {
    super();
    this.wss = new WebSocket.Server({ port });
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);

      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message);
          this.emit("message", data);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });
    });
  }

  broadcast(event: string, data: any) {
    const message = JSON.stringify({ event, data });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}
