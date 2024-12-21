// src/controllers/chat.controller.ts
import { Elysia, t } from "elysia";
import { agents } from "../config/agents";
import type { Message } from "../types/conversation.types";
import type { AppStore } from "../services/app.services";
import type { Agent } from "../types/agent.types";

export const ChatController = new Elysia({ prefix: "/chat" })
  .post(
    "/group-chat/:conversationId",
    async ({ params: { conversationId }, body, store }) => {
      const appStore = store as AppStore;
      try {
        const participants = (body as { participants: string[] }).participants
          .map((id) => agents.find((a) => a.id === id))
          .filter((agent): agent is Agent => agent !== undefined);

        if (participants.length === 0) {
          throw new Error("No valid agents found");
        }

        const response =
          await appStore.services.conversationService.generateGroupResponse(
            participants,
            { topic: (body as { content: string }).content }
          );

        return new Response(JSON.stringify({ content: response }));
      } catch (error) {
        console.error("Group chat error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to process group chat",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 500 }
        );
      }
    },
    {
      body: t.Object({
        participants: t.Array(t.String()),
        content: t.String(),
      }),
    }
  )
  .get(
    "/conversations/:conversationId",
    async ({ params: { conversationId }, store }) => {
      const appStore = store as AppStore;
      try {
        const messages =
          await appStore.services.conversationService.getConversation(
            conversationId
          );
        const state = await appStore.services.conversationService.getState(
          conversationId
        );

        return new Response(JSON.stringify({ messages, state }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error fetching conversation:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to fetch conversation",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 500 }
        );
      }
    }
  );
