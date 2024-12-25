import { Elysia, t } from "elysia";

export const AgentModel = new Elysia().model({
  "agent.create": t.Object({
    name: t.String(),
    role: t.String(),
    personality: t.String(),
    systemPrompt: t.String(),
    interests: t.Array(t.String()),
    preferredStyle: t.Union([
      t.Literal("casual"),
      t.Literal("formal"),
      t.Literal("philosophical"),
      t.Literal("playful"),
      t.Literal("serious"),
    ]),
    memoryWindowSize: t.Number(),
    emotionalRange: t.Object({
      min: t.Number(),
      max: t.Number(),
    }),
    traits: t.Optional(
      t.Object({
        curiosity: t.Number(),
        enthusiasm: t.Number(),
        formality: t.Number(),
        empathy: t.Number(),
        analyticalThinking: t.Number(),
        creativity: t.Number(),
      })
    ),
    contextualResponses: t.Optional(
      t.Object({
        rain: t.Array(t.String()),
        sunny: t.Array(t.String()),
      })
    ),
  }),
  "agent.update": t.Partial(
    t.Object({
      name: t.String(),
      role: t.String(),
      personality: t.String(),
      systemPrompt: t.String(),
      interests: t.Array(t.String()),
      preferredStyle: t.Union([
        t.Literal("casual"),
        t.Literal("formal"),
        t.Literal("philosophical"),
        t.Literal("playful"),
        t.Literal("serious"),
      ]),
      memoryWindowSize: t.Number(),
      emotionalRange: t.Object({
        min: t.Number(),
        max: t.Number(),
      }),
      traits: t.Object({
        curiosity: t.Number(),
        enthusiasm: t.Number(),
        formality: t.Number(),
        empathy: t.Number(),
        analyticalThinking: t.Number(),
        creativity: t.Number(),
      }),
      contextualResponses: t.Object({
        rain: t.Array(t.String()),
        sunny: t.Array(t.String()),
      }),
    })
  ),
});
