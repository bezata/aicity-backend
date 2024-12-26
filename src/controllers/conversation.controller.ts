import { Elysia } from "elysia";
import { ConversationModel } from "../models/conversation.model";
import type { Message } from "../types/conversation.types";
import type { ConversationStyle } from "../types/common.types";
import { t } from "elysia";
import type { AppStore } from "../services/app.services";

// Add this interface to define the message body type
interface MessageBody {
  agentId: string;
  content: string;
  style?: ConversationStyle;
  topics?: string[];
  sentiment?: string;
}

export const ConversationController = ({ store }: { store: AppStore }) =>
  new Elysia({ prefix: "/conversations" })
    .use(ConversationModel)
    .get("/", async () => {
      const activeConversations =
        await store.services.agentConversationService.getActiveConversations();
      return activeConversations.map((conv) => ({
        id: conv.id,
        messages: conv.messages,
        participants: conv.participants,
        activity: conv.activity,
        location: conv.location,
        topic: conv.topic,
      }));
    })
    .get("/:id", async ({ params: { id } }) => {
      const activeConversations =
        await store.services.agentConversationService.getActiveConversations();
      const conversation = activeConversations.find((conv) => conv.id === id);
      return {
        messages: conversation?.messages || [],
      };
    })
    .post(
      "/:id/messages",
      async ({
        params: { id },
        body,
        set,
      }: {
        params: { id: string };
        body: MessageBody;
        set: any;
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
            topics: body.topics,
            sentiment: body.sentiment ? Number(body.sentiment) : undefined,
          };

          // Generate embedding for the message
          const embedding =
            await store.services.togetherService.createEmbedding(
              message.content
            );

          // Store in vector database
          await store.services.vectorStore.upsert({
            id: message.id,
            values: embedding,
            metadata: {
              conversationId: id,
              agentId: message.agentId,
              content: message.content,
              timestamp: message.timestamp,
              role: message.role,
              topics: message.topics,
              sentiment: message.sentiment?.toString(),
            },
          });

          // Update conversation in memory
          conversation.push(message);
          store.conversations.set(id, conversation);

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
    );
