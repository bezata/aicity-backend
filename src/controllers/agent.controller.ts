import { Elysia, t } from "elysia";
import { AgentModel } from "../models/agent.model";
import { agents } from "../config/agents";
import type { Agent } from "../types/agent.types";
import { Message } from "../types/conversation.types";
import { ConversationService } from "../services/conversation.service";
import type { AppStore } from "../services/app.services";

// In-memory store for custom agents
let customAgents: Agent[] = [...agents];

export const AgentController = new Elysia({ prefix: "/agents" })
  .use(AgentModel)
  .get("/", async () => {
    return customAgents;
  })
  .get("/:id", async ({ params: { id } }) => {
    const agent = customAgents.find((agent) => agent.id === id);
    if (!agent) {
      throw new Error("Agent not found");
    }
    return agent;
  })
  .post(
    "/",
    async ({ body }) => {
      const newAgent: Agent = {
        ...body,
        id: crypto.randomUUID(),
        traits: {
          curiosity: 0.5,
          enthusiasm: 0.5,
          formality: 0.5,
          empathy: 0.5,
          analyticalThinking: 0.5,
          creativity: 0.5,
        },
        contextualResponses: {
          rain: ["A default response for rain."],
          sunny: ["A default response for sunny weather."],
        },
      };
      customAgents.push(newAgent);
      return newAgent;
    },
    {
      body: "agent.create",
    }
  )
  .put(
    "/:id",
    async ({ params: { id }, body }) => {
      const index = customAgents.findIndex((agent) => agent.id === id);
      if (index === -1) {
        throw new Error("Agent not found");
      }

      const updatedAgent = {
        ...customAgents[index],
        ...body,
        id, // Preserve the original ID
      };

      customAgents[index] = updatedAgent;
      return updatedAgent;
    },
    {
      body: "agent.update",
    }
  )
  .delete("/:id", async ({ params: { id } }) => {
    const index = customAgents.findIndex((agent) => agent.id === id);
    if (index === -1) {
      throw new Error("Agent not found");
    }

    // Don't allow deletion of default agents
    if (agents.some((a) => a.id === id)) {
      throw new Error("Cannot delete default agent");
    }

    customAgents = customAgents.filter((agent) => agent.id !== id);
    return { success: true, message: "Agent deleted" };
  })
  .post(
    "/send-message/:conversationId/:agentId",
    async ({
      params: { conversationId, agentId },
      body,
      store,
    }: {
      params: { conversationId: string; agentId: string };
      body: { content: string };
      store: { services: { conversationService: ConversationService } };
    }) => {
      try {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) {
          return new Response(JSON.stringify({ error: "Agent not found" }), {
            status: 404,
          });
        }

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

        await store.services.conversationService.addMessage(
          conversationId,
          userMessage
        );

        const response =
          await store.services.conversationService.generateMessage(
            conversationId,
            agent
          );

        return new Response(JSON.stringify({ content: response }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        // ... error handling
      }
    }
  )
  .post(
    "/interact/:agentId1/:agentId2",
    async ({ params: { agentId1, agentId2 }, store }) => {
      const appStore = store as AppStore;
      try {
        const agent1 = customAgents.find((a) => a.id === agentId1);
        const agent2 = customAgents.find((a) => a.id === agentId2);

        if (!agent1 || !agent2) throw new Error("Agent not found");

        // Generate interaction between agents
        const conversation =
          await appStore.services.conversationService.generateAgentInteraction(
            agent1,
            agent2
          );

        return conversation;
      } catch (error) {
        // ... error handling
      }
    }
  )
  .get("/city-status", async ({ store }) => {
    const appStore = store as AppStore;
    return {
      weather: await appStore.services.cityService.getCurrentWeather(),
      mood: await appStore.services.cityService.getCityMood(),
      activeAgents: customAgents.filter((a) => a.isActive),
      currentInteractions:
        await appStore.services.conversationService.getActiveInteractions(),
    };
  })
  .onError(({ code, error }) => {
    if (code === "NOT_FOUND") {
      return { error: "Agent not found", code };
    }
    if (error.message === "Invalid authorization header") {
      return { error: "Unauthorized", code: 401 };
    }
    return {
      error: "Internal server error",
      code: 500,
      message: error.message,
    };
  });
