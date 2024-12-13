import { Elysia, t } from "elysia";

export const AgentModel = new Elysia().model({
  "agent.create": t.Object({
    name: t.String(),
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
  }),
  "agent.update": t.Partial(
    t.Object({
      name: t.String(),
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
    })
  ),
});
