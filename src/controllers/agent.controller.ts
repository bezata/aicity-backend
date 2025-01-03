import { Elysia, t } from "elysia";
import { AgentModel } from "../models/agent.model";
import { residentAgents } from "../config/agents";
import type { Agent } from "../types/agent.types";
import { Message } from "../types/conversation.types";
import { ConversationService } from "../services/conversation.service";
import type { AppStore } from "../services/app.services";
import {
  getAgent,
  getAgentsByCategory,
  getAgentsByDomain,
  getAgentsByInterest,
  getCompatibleAgents,
  getRandomAgent,
  allCityAgents,
  cityManagementAgents,
} from "../config/city-agents";

// In-memory store for custom agents
let customAgents: Agent[] = [...residentAgents];

export const AgentController = new Elysia({ prefix: "/agents" })
  .use(AgentModel)
  .get(
    "/",
    async () => {
      return {
        custom: customAgents,
        city: allCityAgents,
        management: cityManagementAgents,
        resident: residentAgents,
      };
    },
    {
      detail: {
        summary: "Get all agents",
        tags: ["Agents"],
      },
    }
  )
  .get(
    "/category/:category",
    async ({ params: { category } }) => {
      const agents = getAgentsByCategory(category);
      if (!agents.length) {
        throw new Error(`No agents found for category: ${category}`);
      }
      return agents;
    },
    {
      params: t.Object({
        category: t.String({
          description:
            "Category of agents (infrastructure, transportation, environmental, cultural, donation, resident)",
        }),
      }),
      detail: {
        summary: "Get agents by category",
        tags: ["Agents"],
      },
    }
  )
  .get(
    "/domain/:domain",
    async ({ params: { domain } }) => {
      const agents = getAgentsByDomain(domain);
      if (!agents.length) {
        throw new Error(`No agents found for domain: ${domain}`);
      }
      return agents;
    },
    {
      params: t.Object({
        domain: t.String({
          description: "Domain of expertise or interest",
        }),
      }),
      detail: {
        summary: "Get agents by domain",
        tags: ["Agents"],
      },
    }
  )
  .get(
    "/interest/:interest",
    async ({ params: { interest } }) => {
      const agents = getAgentsByInterest(interest);
      if (!agents.length) {
        throw new Error(`No agents found for interest: ${interest}`);
      }
      return agents;
    },
    {
      params: t.Object({
        interest: t.String({
          description: "Specific interest or skill",
        }),
      }),
      detail: {
        summary: "Get agents by interest",
        tags: ["Agents"],
      },
    }
  )
  .get(
    "/compatible/:agentId",
    async ({ params: { agentId } }) => {
      const agent = getAgent(agentId);
      if (!agent) {
        throw new Error("Agent not found");
      }
      const compatibleAgents = getCompatibleAgents(agent);
      return compatibleAgents;
    },
    {
      params: t.Object({
        agentId: t.String({
          description: "ID of the agent to find compatible agents for",
        }),
      }),
      detail: {
        summary: "Get compatible agents",
        tags: ["Agents"],
      },
    }
  )
  .get(
    "/random",
    () => {
      return getRandomAgent();
    },
    {
      detail: {
        summary: "Get a random agent",
        tags: ["Agents"],
      },
    }
  )
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
      const defaultTraits = {
        curiosity: 0.5,
        enthusiasm: 0.5,
        formality: 0.5,
        empathy: 0.5,
        analyticalThinking: 0.5,
        creativity: 0.5,
      };

      const defaultResponses = {
        rain: ["A default response for rain."],
        sunny: ["A default response for sunny weather."],
      };

      const newAgent: Agent = {
        id: crypto.randomUUID(),
        name: body.name,
        role: body.role,
        personality: body.personality,
        systemPrompt: body.systemPrompt,
        interests: body.interests,
        preferredStyle: body.preferredStyle,
        memoryWindowSize: body.memoryWindowSize,
        emotionalRange: body.emotionalRange,
        traits: body.traits || defaultTraits,
        contextualResponses: body.contextualResponses || defaultResponses,
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
    if (residentAgents.some((a) => a.id === id)) {
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
        const agent = getAgent(agentId);
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
          topics: [],
          sentiment: undefined,
        };

        await store.services.conversationService.addMessage(
          conversationId,
          userMessage.agentId,
          userMessage.content
        );

        const response =
          await store.services.conversationService.generateMessage(
            getAgent(agentId)!,
            {
              topic: "User interaction",
              ...(agent.districtId && {
                location: {
                  districtId: agent.districtId,
                  coordinates: [0, 0], // Default coordinates or get from district service
                },
              }),
              urgency: 0.5,
            }
          );

        return new Response(JSON.stringify({ content: response }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error sending message:", error);
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
  .get("/:id/location", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    try {
      // Create embedding for query
      const embedding = await appStore.services.vectorStore.createEmbedding(
        `agent ${id} location`
      );

      const location = await appStore.services.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $in: ["agent_residence", "agent_visit"] },
          agentId: { $eq: id },
        },
        topK: 1,
      });

      return {
        success: true,
        data: location.matches[0]?.metadata,
      };
    } catch (error) {
      console.error("Failed to get agent location:", error);
      throw error;
    }
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
