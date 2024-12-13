import { Elysia, t } from "elysia";
import { AgentModel } from "../models/agent.model";
import { agents } from "../config/agents";
import type { Agent } from "../types/agent.types";

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
