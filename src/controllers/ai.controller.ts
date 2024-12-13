import { Elysia, t } from "elysia";
import { Stream } from "@elysiajs/stream";
import { TogetherService } from "../services/together.service";
import { VectorStoreService } from "../services/vector-store.service";
import { ConversationService } from "../services/conversation.service";
import { agents } from "../config/agents";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

// Create singleton instances of services
const togetherService = new TogetherService(process.env.TOGETHER_API_KEY!);
const vectorStore = new VectorStoreService(process.env.PINECONE_API_KEY!);
const conversationService = new ConversationService(
  togetherService,
  vectorStore
);

export const AIController = new Elysia({ prefix: "/ai" })
  .state("conversations", new Map<string, Message[]>())
  .state("services", {
    togetherService,
    vectorStore,
    conversationService,
  })
  .post(
    "/send-message/:conversationId/:agentId",
    async ({
      params: { conversationId, agentId },
      body,
      store,
      store: { services },
    }) => {
      try {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) {
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Get or initialize conversation history
        const history = store.conversations.get(conversationId) || [];

        const userMessage: Message = {
          id: crypto.randomUUID(),
          agentId: agent.id,
          role: "user" as const,
          content: body.content,
          timestamp: Date.now(),
        };

        // Add user message to history
        history.push(userMessage);

        const response = await services.togetherService.generateResponse(
          agent,
          history, // Pass full history
          agent.systemPrompt
        );

        const agentMessage: Message = {
          id: crypto.randomUUID(),
          agentId: agent.id,
          role: "assistant" as const,
          content: response,
          timestamp: Date.now(),
        };

        // Add agent response to history
        history.push(agentMessage);
        store.conversations.set(conversationId, history);

        return new Response(
          JSON.stringify({
            userMessage,
            agentResponse: agentMessage,
            history,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Message send error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to send message",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    },
    {
      body: t.Object({
        content: t.String(),
      }),
    }
  )
  .get("/conversations/:id", async ({ params: { id }, store }) => {
    const history = store.conversations.get(id) || [];
    return new Response(JSON.stringify({ history }), {
      headers: { "Content-Type": "application/json" },
    });
  })

  .get(
    "/test-stream/:message",
    async ({ params: { message }, store: { services } }) => {
      try {
        const testMessage = {
          role: "user",
          content: message,
        };

        const response = await services.togetherService.generateResponse(
          agents[0],
          [testMessage as Message],
          "You are a helpful assistant."
        );

        return new Response(response);
      } catch (error) {
        console.error("Error:", error);
        return new Response(
          JSON.stringify({
            error: "Response generation failed",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 500 }
        );
      }
    }
  )
  .get(
    "/chat/:conversationId/:agentId",
    async ({ params: { conversationId, agentId }, store: { services } }) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) {
        return new Response(JSON.stringify({ error: "Agent not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            Connection: "keep-alive",
            "Keep-Alive": "timeout=60",
          },
        });
      }

      try {
        const response = await services.conversationService.generateMessage(
          conversationId,
          agent
        );

        return new Response(JSON.stringify({ content: response }), {
          headers: {
            "Content-Type": "application/json",
            Connection: "keep-alive",
            "Keep-Alive": "timeout=60",
          },
        });
      } catch (error) {
        console.error("Error:", error);
        return new Response(
          JSON.stringify({
            error: "Response generation failed",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              Connection: "keep-alive",
              "Keep-Alive": "timeout=60",
            },
          }
        );
      }
    }
  )
  // This will be in main version
  //.get("/conversations/:id", ({ params: { id }, store: { services } }) => {
  // return services.conversationService.getConversation(id);
  // })

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
