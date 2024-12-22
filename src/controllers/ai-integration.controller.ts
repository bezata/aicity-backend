import { Elysia, t } from "elysia";
import { AIIntegrationService } from "../services/ai-integration.service";
import {
  AIDecisionContext,
  AIInteractionProtocol,
  CityPattern,
  AIAnalysis,
} from "../types/ai-integration.types";
import { swagger } from "@elysiajs/swagger";

// Request body types for validation
const DecisionRequestSchema = t.Object({
  context: t.String(),
  options: t.Array(t.String()),
});

const InteractionRequestSchema = t.Object({
  userId: t.String(),
  input: t.String(),
  context: t.Any(),
});

const PatternRequestSchema = t.Object({
  data: t.Any(),
});

export function setupAIRoutes(app: Elysia, aiService: AIIntegrationService) {
  return app.use(swagger()).group("/ai", (app) =>
    app
      // Make AI-driven decision
      .post(
        "/decision",
        async ({ body }) => {
          const result = await aiService.makeDecision(
            body.context,
            body.options
          );
          return result;
        },
        {
          body: DecisionRequestSchema,
          detail: {
            summary: "Make an AI-driven decision",
            tags: ["AI Integration"],
          },
        }
      )

      // Handle AI-human interaction
      .post(
        "/interaction",
        async ({ body }) => {
          const result = await aiService.handleInteraction(
            body.userId,
            body.input,
            body.context
          );
          return result;
        },
        {
          body: InteractionRequestSchema,
          detail: {
            summary: "Handle AI-human interaction",
            tags: ["AI Integration"],
          },
        }
      )

      // Learn and analyze pattern
      .post(
        "/pattern",
        async ({ body }) => {
          const result = await aiService.learnPattern(body.data);
          return result;
        },
        {
          body: PatternRequestSchema,
          detail: {
            summary: "Learn and analyze a new pattern",
            tags: ["AI Integration"],
          },
        }
      )

      // Get all significant patterns
      .get(
        "/patterns",
        async ({ query }) => {
          const minConfidence = Number(query?.confidence) || 0.7;
          const patterns = Array.from(aiService.getCityPatterns().values());
          return patterns.filter((p) => p.confidence >= minConfidence);
        },
        {
          query: t.Object({
            confidence: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: "Get all significant patterns",
            tags: ["AI Integration"],
          },
        }
      )

      // Get specific pattern by ID
      .get(
        "/pattern/:id",
        async ({ params: { id } }) => {
          return aiService.getCityPatterns().get(id);
        },
        {
          params: t.Object({
            id: t.String(),
          }),
          detail: {
            summary: "Get a specific pattern by ID",
            tags: ["AI Integration"],
          },
        }
      )

      // Get all interaction protocols
      .get(
        "/protocols",
        async () => {
          return Array.from(aiService.getInteractionProtocols().entries()).map(
            ([userId, protocol]) => ({ userId, protocol })
          );
        },
        {
          detail: {
            summary: "Get all interaction protocols",
            tags: ["AI Integration"],
          },
        }
      )

      // Get interaction protocol for specific user
      .get(
        "/protocol/:userId",
        async ({ params: { userId } }) => {
          return aiService.getInteractionProtocols().get(userId);
        },
        {
          params: t.Object({
            userId: t.String(),
          }),
          detail: {
            summary: "Get interaction protocol for a specific user",
            tags: ["AI Integration"],
          },
        }
      )

      // Get recent decision history
      .get(
        "/decisions",
        async ({ query }) => {
          const hours = Number(query?.hours) || 24;
          const cutoff = Date.now() - hours * 60 * 60 * 1000;

          return Array.from(aiService.getDecisionHistory().entries())
            .filter(
              ([_, context]) => new Date(context.timeframe).getTime() > cutoff
            )
            .map(([id, context]) => ({ id, context }));
        },
        {
          query: t.Object({
            hours: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: "Get recent decision history",
            tags: ["AI Integration"],
          },
        }
      )

      // Get AI analysis of current city state
      .get(
        "/analysis",
        async () => {
          const patterns = Array.from(
            aiService.getCityPatterns().values()
          ).filter((p) => p.confidence > 0.7);
          const decisions = Array.from(
            aiService.getDecisionHistory().values()
          ).filter(
            (d) =>
              new Date(d.timeframe).getTime() > Date.now() - 24 * 60 * 60 * 1000
          );
          const protocols = Array.from(
            aiService.getInteractionProtocols().values()
          );

          return {
            patterns,
            decisions,
            protocols,
          };
        },
        {
          detail: {
            summary: "Get AI analysis of current city state",
            tags: ["AI Integration"],
          },
        }
      )
  );
}
