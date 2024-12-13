import { Elysia, t } from "elysia";

export const ConversationModel = new Elysia().model({
  "conversation.create": t.Object({
    agentId: t.String(),
    message: t.String(),
    style: t.Optional(t.String()),
    context: t.Optional(t.String()),
  }),

  "conversation.message": t.Object({
    agentId: t.String(),
    content: t.String(),
    style: t.Optional(
      t.Union([
        t.Literal("casual"),
        t.Literal("formal"),
        t.Literal("philosophical"),
        t.Literal("playful"),
        t.Literal("serious"),
      ])
    ),
    topics: t.Optional(t.Array(t.String())),
    sentiment: t.Optional(t.Number()),
  }),

  "conversation.state": t.Object({
    momentum: t.Number(),
    lastInteractionTime: t.Number(),
    currentStyle: t.String(),
    emotionalState: t.Number(),
    silenceProbability: t.Number(),
  }),
});
