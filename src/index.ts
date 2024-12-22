import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import { Handler } from "elysia";
import { verifyAuth } from "./middleware/auth";
import { ErrorResponse } from "./types/common.types";

// Import controllers
import { CityRhythmController } from "./controllers/city-rhythm.controller";
import { CityCoordinatorController } from "./controllers/city-coordinator.controller";
import { AdaptiveLearningController } from "./controllers/adaptive-learning.controller";
import { AIController } from "./controllers/ai.controller";
import { AIIntegrationController } from "./controllers/ai-integration.controller";
import { DepartmentController } from "./controllers/department.controller";
import { DistrictController } from "./controllers/district.controller";
import { DonationController } from "./controllers/donation.controller";
import { createStore } from "./services/app.services";

const store = createStore();
type ElysiaInstance = InstanceType<typeof Elysia>;
type ElysiaConfig = Parameters<ElysiaInstance["group"]>[1];

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "AI City API",
          version: "1.0.0",
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    })
  )
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "your-secret-key",
    })
  )
  .use(cors())
  .onError(({ code, error }) => {
    console.error(`Error ${code}:`, error);
    return {
      success: false,
      error: error.message,
      code: typeof code === "string" ? 500 : code,
    } as ErrorResponse;
  })
  .derive(({ jwt }) => {
    return {
      jwt,
      store,
    };
  });

// Mount controllers
const apiGroup = app.group("/api", ((app: any) => {
  return (
    app
      // Function-style controllers that take store
      .use(CityRhythmController({ store }))
      .use(CityCoordinatorController({ store }))
      // Function-style controllers that take service
      .use(DonationController(store.services.donationService))
      // Pre-configured Elysia instances
      .use(DepartmentController)
      .use(DistrictController)
      .use(AIController)
      // Class-style controllers with setup method
      .use((app: any) => new AdaptiveLearningController(store).setup(app))
      .use((app: any) =>
        new AIIntegrationController(store.services.aiIntegration).setup(app)
      )
      .group("ai", (app: any) => {
        return app
          .post(
            "/initialize",
            async ({ body, jwt }: { body: any; jwt: any }) => {
              const result =
                await store.services.aiIntegration.initializeSystem(body);
              const accessToken = await jwt.sign({
                systemId: result.systemId,
                timestamp: Date.now(),
              });
              return {
                success: true,
                data: {
                  ...result,
                  accessToken,
                },
              };
            },
            {
              body: t.Object({
                agents: t.Array(t.String()),
                protocol: t.String(),
                initialState: t.Optional(t.Record(t.String(), t.Any())),
              }),
            }
          )
          .post(
            "/decision",
            async ({ body }: { body: any }) => {
              await store.services.aiIntegration.recordDecision(
                body.agentId,
                body.decision,
                body.context
              );
              return { success: true, data: null };
            },
            {
              beforeHandle: [
                verifyAuth as any,
                () => {
                  if (!store.services.aiIntegration.isInitialized()) {
                    throw new Error("System not initialized");
                  }
                },
              ],
              body: t.Object({
                agentId: t.String(),
                decision: t.String(),
                context: t.Record(t.String(), t.Any()),
              }),
            }
          )
          .post(
            "/pattern",
            async ({ body }: { body: any }) => {
              await store.services.aiIntegration.storePattern(
                body.pattern,
                body.context,
                body.confidence
              );
              return { success: true, data: null };
            },
            {
              beforeHandle: [
                verifyAuth as any,
                () => {
                  if (!store.services.aiIntegration.isInitialized()) {
                    throw new Error("System not initialized");
                  }
                },
              ],
              body: t.Object({
                pattern: t.String(),
                context: t.Record(t.String(), t.Any()),
                confidence: t.Number(),
              }),
            }
          )
          .get(
            "/similar-decisions",
            async ({ query }: { query: any }) => {
              const decisions =
                await store.services.aiIntegration.findSimilarDecisions(
                  query.content,
                  query.limit ? parseInt(query.limit) : undefined
                );
              return { success: true, data: decisions };
            },
            {
              beforeHandle: [
                verifyAuth as any,
                () => {
                  if (!store.services.aiIntegration.isInitialized()) {
                    throw new Error("System not initialized");
                  }
                },
              ],
              query: t.Object({
                content: t.String(),
                limit: t.Optional(t.String()),
              }),
            }
          )
          .get(
            "/similar-patterns",
            async ({ query }: { query: any }) => {
              const patterns =
                await store.services.aiIntegration.findSimilarPatterns(
                  query.content,
                  query.limit ? parseInt(query.limit) : undefined
                );
              return { success: true, data: patterns };
            },
            {
              beforeHandle: [
                verifyAuth as any,
                () => {
                  if (!store.services.aiIntegration.isInitialized()) {
                    throw new Error("System not initialized");
                  }
                },
              ],
              query: t.Object({
                content: t.String(),
                limit: t.Optional(t.String()),
              }),
            }
          )
          .get(
            "/status",
            async () => {
              const status = store.services.aiIntegration.getSystemStatus();
              return { success: true, data: status };
            },
            {
              beforeHandle: [
                verifyAuth as any,
                () => {
                  if (!store.services.aiIntegration.isInitialized()) {
                    throw new Error("System not initialized");
                  }
                },
              ],
            }
          );
      })
  );
}) as unknown as ElysiaConfig);

app.use(apiGroup as any);

app.listen(process.env.PORT || 3000);

console.log(
  `🦊 AI City server is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
