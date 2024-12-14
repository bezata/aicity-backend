// src/controllers/chat.controller.ts
import { Elysia, t } from "elysia";
import { agents } from "../config/agents";
import type { Message } from "../types/conversation.types";
import { services } from "../services/app.services";

export const ChatController = new Elysia({ prefix: "/chat" })
  .state("services", services)
  /**
   * @summary Send a message to an agent
   * @tags Chat
   */
  .post(
    "/send/:conversationId",
    async ({ params: { conversationId }, body, store: { services } }) => {
      try {
        const agent = agents.find((a) => a.id === body.agentId);
        if (!agent) {
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
          });
        }

        // Create user message
        const userMessage: Message = {
          id: crypto.randomUUID(),
          agentId: "user",
          content: body.content,
          timestamp: Date.now(),
          role: "user",
          style: undefined,
          topics: [],
          sentiment: undefined,
        };

        // Add message and get response
        await services.conversationService.addMessage(
          conversationId,
          userMessage
        );
        const response = await services.conversationService.generateMessage(
          conversationId,
          agent
        );

        return new Response(JSON.stringify({ content: response }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Chat error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to process message",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 500 }
        );
      }
    },
    {
      body: t.Object({
        agentId: t.String(),
        content: t.String(),
      }),
    }
  );
