import { Elysia } from "elysia";
import { ConversationModel } from "../models/conversation.model";
import type { Message } from "../types/conversation.types";
import { Stream } from "@elysiajs/stream";
import type { ConversationStyle } from "../types/common.types";
import { t } from "elysia";

interface WSMessage {
  type: "message" | "error";
  data?: any;
  message?: string;
}

export const ConversationController = new Elysia({ prefix: "/conversations" })
  .use(ConversationModel)
  .state("conversations", new Map<string, Message[]>())
  .derive(({ store }) => ({
    getConversation: (id: string) => store.conversations.get(id) || [],
  }))
  .get("/", ({ store }) => {
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
    ({ params: { id }, body, store, set }) => {
      const conversation = store.conversations.get(id) || [];

      // Create message with proper typing
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
    open(ws: { 
      data: { params: { id: string } };
      subscribe: (room: string) => void;
    }) {
      const conversationId = ws.data.params.id;
      ws.subscribe(conversationId);
      console.log(`WebSocket connected to conversation: ${conversationId}`);
    },
    message(ws: { 
      data: { params: { id: string } };
      publish: (room: string, message: string) => void;
      send: (message: string) => void;
      unsubscribe: (room: string) => void;
    }, rawMessage) {
      const conversationId = ws.data.params.id;
      try {
        const message = JSON.parse(rawMessage as string);
        const response: WSMessage = {
          type: "message",
          data: message,
        };
        ws.publish(conversationId, JSON.stringify(response));
      } catch (error) {
        const errorResponse: WSMessage = {
          type: "error",
          message: "Invalid message format",
        };
        ws.send(JSON.stringify(errorResponse));
      }
    },
    close(ws: { 
      data: { params: { id: string } };
      unsubscribe: (room: string) => void;
    }) {
      const conversationId = ws.data.params.id;
      ws.unsubscribe(conversationId);
      console.log(
        `WebSocket disconnected from conversation: ${conversationId}`
      );
    },
  });
