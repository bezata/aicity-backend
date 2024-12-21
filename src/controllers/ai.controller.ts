import { Elysia, t } from "elysia";
import { agents } from "../config/agents";
import type { Message } from "../types/conversation.types";
import type { AppStore } from "../services/app.services";

export const AIController = new Elysia({ prefix: "/ai" })
  .post(
    "/send-message/:conversationId/:agentId",
    async ({ params: { conversationId, agentId }, body, store }) => {
      const appStore = store as AppStore;
      try {
        console.log("🚀 Processing message request:", {
          conversationId,
          agentId,
          body,
        });

        const agent = agents.find((a) => a.id === agentId);
        if (!agent) {
          console.log("❌ Agent not found:", agentId);
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
          });
        }
        console.log("✅ Found agent:", agent.name);

        // Initialize conversation if it doesn't exist
        if (!appStore.conversations.has(conversationId)) {
          console.log("📝 Initializing new conversation:", conversationId);
          appStore.conversations.set(conversationId, []);
        }

        // First add user message
        const userMessage: Message = {
          id: crypto.randomUUID(),
          agentId: "user",
          content: body.message,
          timestamp: Date.now(),
          role: "user",
          topics: ["city-context"],
        };

        console.log("📨 Adding user message:", userMessage);
        await appStore.services.conversationService.addMessage(
          conversationId,
          "user",
          body.message
        );

        // Then generate agent response
        console.log("🤖 Generating agent response...");
        const response =
          await appStore.services.conversationService.generateMessage(agent, {
            topic: body.message,
          });
        console.log("✅ Generated response:", response);

        return new Response(JSON.stringify({ content: response }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("❌ Message send error:", error);
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
        message: t.String(),
      }),
    }
  )
  .options(
    "/send-message/:conversationId/:agentId",
    () => new Response(null, { status: 204 })
  )
  .get("/conversations/:id", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    const history = appStore.conversations.get(id) || [];
    return new Response(JSON.stringify({ history }), {
      headers: { "Content-Type": "application/json" },
    });
  })

  .get("/test-stream/:message", async ({ params: { message }, store }) => {
    const appStore = store as AppStore;
    try {
      const testMessage = {
        role: "user",
        content: message,
      };

      const defaultAgent = agents[0];
      if (!defaultAgent) {
        throw new Error("No agents configured");
      }

      const response = await appStore.services.togetherService.generateResponse(
        defaultAgent,
        [testMessage as Message],
        defaultAgent.systemPrompt
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
  })
  .get(
    "/chat/:conversationId/:agentId",
    async ({ params: { conversationId, agentId }, store }) => {
      const appStore = store as AppStore;
      const foundAgent = agents.find((a) => a.id === agentId);
      if (!foundAgent) {
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
        const response =
          await appStore.services.conversationService.generateMessage(
            foundAgent,
            { topic: "chat" }
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

  .get("/conversations/:id/state", ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    return appStore.services.conversationService.getState(id);
  })
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
