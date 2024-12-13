import { Elysia, t } from "elysia";

export const AgentModel = new Elysia().model({
  "agent.create": t.Object({
    name: t.String(),
    personality: t.String(),
    systemPrompt: t.String(),
    interests: t.Array(t.String()),
    preferredStyle: t.String(),
    memoryWindowSize: t.Number(),
    emotionalRange: t.Object({
      min: t.Number(),
      max: t.Number(),
    }),
  }),

  "agent.response": t.Object({
    id: t.String(),
    name: t.String(),
    personality: t.String(),
    interests: t.Array(t.String()),
    preferredStyle: t.String(),
  }),
});
