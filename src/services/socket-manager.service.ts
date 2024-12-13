import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Message } from "../types/conversation.types";

export class SocketManager extends EventEmitter {
  private rooms: Map<string, Set<WebSocket>> = new Map();

  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.on(
      "messageCreated",
      (data: { conversationId: string; message: Message }) => {
        this.broadcastToRoom(data.conversationId, {
          type: "message",
          payload: data.message,
        });
      }
    );

    this.on("stateUpdated", (data: { conversationId: string; state: any }) => {
      this.broadcastToRoom(data.conversationId, {
        type: "state",
        payload: data.state,
      });
    });

    this.on(
      "agentTyping",
      (data: { conversationId: string; agentId: string }) => {
        this.broadcastToRoom(data.conversationId, {
          type: "typing",
          payload: { agentId: data.agentId },
        });
      }
    );
  }

  joinRoom(conversationId: string, socket: WebSocket) {
    if (!this.rooms.has(conversationId)) {
      this.rooms.set(conversationId, new Set());
    }
    this.rooms.get(conversationId)!.add(socket);
  }

  leaveRoom(conversationId: string, socket: WebSocket) {
    this.rooms.get(conversationId)?.delete(socket);
    if (this.rooms.get(conversationId)?.size === 0) {
      this.rooms.delete(conversationId);
    }
  }

  private broadcastToRoom(roomId: string, message: any) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const payload = JSON.stringify(message);
    room.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    });
  }
}
