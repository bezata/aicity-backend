import { Elysia } from "elysia";
import { ConversationModel } from "../models/conversation.model";
import type { Message } from "../types/conversation.types";
import type { ConversationStyle } from "../types/common.types";
import { t } from "elysia";
import type { WebSocket } from "ws";

interface WSMessage {
  type: "message" | "error" | "status";
  data?: any;
  message?: string;
}

// Define WebSocket connection type
type WSConnection = {
  data: {
    params: {
      id: string;
    };
  };
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
  send: (message: string) => void;
  publish: (room: string, message: string) => void;
};

// Create a store type
type Store = {
  conversations: Map<string, Message[]>;
  wsConnections: Map<string, Set<WSConnection>>;
};

export const ConversationController = new Elysia({ prefix: "/conversations" })
  .use(ConversationModel)
  .state("conversations", new Map<string, Message[]>())
  .state("wsConnections", new Map<string, Set<WSConnection>>())
  .derive(({ store }: { store: Store }) => ({
    getConversation: (id: string) => store.conversations.get(id) || [],
    getWSConnections: (id: string) => store.wsConnections.get(id) || new Set(),
  }))
  .get("/", ({ store }: { store: Store }) => {
    const conversations: Record<string, Message[]> = {};
    for (const [id, messages] of store.conversations) {
      conversations[id] = messages;
    }
    return conversations;
  })
  .get("/:id", ({ params: { id }, getConversation }) => ({
    messages: getConversation(id),
  }))
  .post(
    "/:id/messages",
    ({
      params: { id },
      body,
      store,
      set,
    }: {
      params: { id: string };
      body: any;
      store: Store;
      set: any;
    }) => {
      const conversation = store.conversations.get(id) || [];

      const message: Message = {
        id: crypto.randomUUID(),
        agentId: body.agentId,
        content: body.content,
        timestamp: Date.now(),
        role: "user",
        style: body.style as ConversationStyle | undefined,
        topics: body.topics,
        sentiment: body.sentiment,
      };

      conversation.push(message);
      store.conversations.set(id, conversation);

      // Broadcast the new message to all connected clients
      const connections = store.wsConnections.get(id);
      if (connections) {
        const response: WSMessage = {
          type: "message",
          data: message,
        };
        for (const ws of connections) {
          ws.send(JSON.stringify(response));
        }
      }

      set.status = 201;
      return message;
    },
    {
      body: "conversation.message",
    }
  )
  .ws("/ws/:id", {
    body: t.Object({
      type: t.String(),
      data: t.Any(),
    }),
    open(ws: WSConnection) {
      const conversationId = ws.data.params.id;
      const store = (this as any).store as Store;

      // Initialize connections set if it doesn't exist
      if (!store.wsConnections.has(conversationId)) {
        store.wsConnections.set(conversationId, new Set());
      }

      // Add the connection to the set
      const connections = store.wsConnections.get(conversationId);
      connections?.add(ws);

      // Subscribe to the room
      ws.subscribe(conversationId);

      // Send connection confirmation
      ws.send(
        JSON.stringify({
          type: "status",
          message: "Connected successfully",
        })
      );

      console.log(`WebSocket connected to conversation: ${conversationId}`);
    },

    message(ws: WSConnection, message: { type: string; data: any }) {
      const conversationId = ws.data.params.id;
      const store = (this as any).store as Store;

      try {
        const parsedMessage = message.data;

        const response: WSMessage = {
          type: "message",
          data: parsedMessage,
        };

        // Broadcast to all clients in the room
        const connections = store.wsConnections.get(conversationId);
        if (connections) {
          for (const client of connections) {
            client.send(JSON.stringify(response));
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Message processing failed",
          })
        );
      }
    },

    close(ws: WSConnection) {
      const conversationId = ws.data.params.id;
      const store = (this as any).store as Store;

      // Remove the connection from the set
      const connections = store.wsConnections.get(conversationId);
      if (connections) {
        connections.delete(ws);

        // Clean up empty connection sets
        if (connections.size === 0) {
          store.wsConnections.delete(conversationId);
        }
      }

      // Unsubscribe from the room
      ws.unsubscribe(conversationId);

      console.log(
        `WebSocket disconnected from conversation: ${conversationId}`
      );
    },
  });
