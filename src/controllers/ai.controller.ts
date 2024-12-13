import { Elysia } from "elysia";
import { Stream } from "@elysiajs/stream";
import { TogetherService } from "../services/together.service";
import { VectorStoreService } from "../services/vector-store.service";
import { ConversationService } from "../services/conversation.service";
import { agents } from "../config/agents";
import type { Agent } from "../types/agent.types";

// Create singleton instances of services
const togetherService = new TogetherService(process.env.TOGETHER_API_KEY!);
const vectorStore = new VectorStoreService(process.env.PINECONE_API_KEY!);
const conversationService = new ConversationService(
  togetherService,
  vectorStore
);

export const AIController = new Elysia({ prefix: "/ai" })
  .state("services", {
    togetherService,
    vectorStore,
    conversationService,
  })
  .get(
    "/chat/:conversationId/:agentId",
    async ({ params: { conversationId, agentId }, store: { services } }) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) {
        return new Response(JSON.stringify({ error: "Agent not found" }), {
          status: 404,
        });
      }

      return new Stream(async (stream) => {
        try {
          for await (const chunk of services.conversationService.generateMessageStream(
            conversationId,
            agent
          )) {
            stream.send(chunk);
          }
        } catch (error) {
          console.error("Stream error:", error);
          stream.send(
            JSON.stringify({
              error: "Stream generation failed",
              message: error instanceof Error ? error.message : "Unknown error",
            })
          );
        } finally {
          stream.send("");
        }
      });
    }
  )
  .get("/conversations/:id", ({ params: { id }, store: { services } }) => {
    return services.conversationService.getConversation(id);
  })
  .get(
    "/conversations/:id/state",
    ({ params: { id }, store: { services } }) => {
      return services.conversationService.getState(id);
    }
  )
  .onError(({ code, error }) => {
    console.error(`Error in AI Controller [${code}]:`, error);

    if (code === "NOT_FOUND") {
      return new Response(JSON.stringify({ error: "Resource not found" }), {
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  });
