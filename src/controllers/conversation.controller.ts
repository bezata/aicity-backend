import { Elysia } from "elysia";
import { ConversationModel } from "../models/conversation.model";
import type { Message } from "../types/conversation.types";
import type { ConversationStyle } from "../types/common.types";
import { t } from "elysia";
import { VectorStoreService } from "../services/vector-store.service";
import { TogetherService } from "../services/together.service";

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
  vectorStore: VectorStoreService;
  togetherService: TogetherService;
};

// Add this interface to define the message body type
interface MessageBody {
  agentId: string;
  content: string;
  style?: ConversationStyle;
  topics?: string[];
  sentiment?: string; // Make sure this is string type
}

export const ConversationController = new Elysia({ prefix: "/conversations" })
  .use(ConversationModel)
  .state("conversations", new Map<string, Message[]>())
  .state("wsConnections", new Map<string, Set<WSConnection>>())
  .state(
    "vectorStore",
    new VectorStoreService(new TogetherService(process.env.TOGETHER_API_KEY!))
  )
  .state("togetherService", new TogetherService(process.env.TOGETHER_API_KEY!))
  .derive(({ store }: { store: Store }) => ({
    getConversation: (id: string) => store.conversations.get(id) || [],
    getWSConnections: (id: string) => store.wsConnections.get(id) || new Set(),
    vectorStore: store.vectorStore,
    togetherService: store.togetherService,
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
    async ({
      params: { id },
      body,
      store,
      set,
      vectorStore,
      togetherService,
    }: {
      params: { id: string };
      body: MessageBody; // Use the new interface
      store: Store;
      set: any;
      vectorStore: VectorStoreService;
      togetherService: TogetherService;
    }) => {
      try {
        const conversation = store.conversations.get(id) || [];

        // Create the message
        const message: Message = {
          id: crypto.randomUUID(),
          agentId: body.agentId,
          content: body.content,
          timestamp: Date.now(),
          role: "user",
          style: body.style,
          topics: body.topics,
          sentiment: body.sentiment ? Number(body.sentiment) : undefined,
        };

        // Generate embedding for the message
        const embedding = await togetherService.createEmbedding(
          message.content
        );

        // Store in vector database
        await vectorStore.upsert({
          id: message.id,
          values: embedding,
          metadata: {
            conversationId: id,
            agentId: message.agentId,
            content: message.content,
            timestamp: message.timestamp,
            role: message.role,
            topics: message.topics,
            style: message.style,
            sentiment: message.sentiment?.toString(),
          },
        });

        // Update conversation in memory
        conversation.push(message);
        store.conversations.set(id, conversation);

        // Broadcast to WebSocket connections
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
      } catch (error) {
        console.error("Error processing message:", error);
        set.status = 500;
        return {
          error: "Failed to process message",
          details: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        agentId: t.String(),
        content: t.String(),
        style: t.Optional(t.String()),
        topics: t.Optional(t.Array(t.String())),
        sentiment: t.Optional(t.String()),
      }),
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

      if (!store.wsConnections.has(conversationId)) {
        store.wsConnections.set(conversationId, new Set());
      }

      const connections = store.wsConnections.get(conversationId);
      connections?.add(ws);
      ws.subscribe(conversationId);

      ws.send(
        JSON.stringify({
          type: "status",
          message: "Connected successfully",
        })
      );
    },

    message: async function (
      ws: WSConnection,
      message: { type: string; data: any }
    ) {
      const conversationId = ws.data.params.id;
      const store = (this as any).store as Store;

      try {
        const parsedMessage = message.data;

        // Generate embedding
        const embedding = await store.togetherService.createEmbedding(
          parsedMessage.content
        );

        // Store in vector database
        await store.vectorStore.upsert({
          id: parsedMessage.id || crypto.randomUUID(),
          values: embedding,
          metadata: {
            conversationId,
            content: parsedMessage.content,
            timestamp: Date.now(),
            agentId: parsedMessage.agentId,
            role: parsedMessage.role || "user",
          },
        });

        const response: WSMessage = {
          type: "message",
          data: parsedMessage,
        };

        // Broadcast to all clients
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

      const connections = store.wsConnections.get(conversationId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          store.wsConnections.delete(conversationId);
        }
      }

      ws.unsubscribe(conversationId);
    },
  });
