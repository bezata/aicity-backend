import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import { verifyAuth } from "./middleware/auth";
import { ErrorResponse } from "./types/responses";
import { agents, residentAgents } from "./config/agents";
import { cityManagementAgents, allCityAgents } from "./config/city-agents";

// Import controllers
import { CityRhythmController } from "./controllers/city-rhythm.controller";
import { CityCoordinatorController } from "./controllers/city-coordinator.controller";
import { AdaptiveLearningController } from "./controllers/adaptive-learning.controller";
import { AIController } from "./controllers/ai.controller";
import { AIIntegrationController } from "./controllers/ai-integration.controller";
import { DepartmentController } from "./controllers/department.controller";
import { createStore } from "./services/app.services";
import { DistrictController } from "./controllers/district.controller";
import { DonationController } from "./controllers/donation.controller";
import { DistrictMetricsController } from "./controllers/district-metrics.controller";

type ElysiaInstance = InstanceType<typeof Elysia>;
type ElysiaConfig = Parameters<ElysiaInstance["group"]>[1];
const store = createStore();

// Initialize AI system with all agents
async function initializeAISystem() {
  try {
    const allAgents = [...allCityAgents.map((agent) => agent.id)];

    // Create Pinecone-compatible metadata
    const residentAgentIds = residentAgents.map((a) => a.id).join(",");
    const cityAgentIds = cityManagementAgents.map((a) => a.id).join(",");

    const result = await store.services.aiIntegration.initializeSystem({
      agents: allAgents,
      protocol: {
        name: "city-management",
        version: "1.0.0",
        rules: [
          "The city is a living organism that evolves and adapts to the needs of its residents.",
          "The city is a collaborative entity that works together to achieve its goals.",
          "The city is a sustainable entity that works together to achieve its goals.",
          "The city is a resilient entity that works together to achieve its goals.",
        ],
      },
      initialState: {
        resident_agents: residentAgentIds, // String value
        city_agents: cityAgentIds, // String value
        agent_count: allAgents.length, // Number value
        initialized: true, // Boolean value
        agent_types: allAgents.map((id) => {
          // Array of strings
          if (residentAgents.map((a) => a.id).includes(id))
            return `${id}:resident`;
          if (cityManagementAgents.map((a) => a.id).includes(id))
            return `${id}:management`;
          return `${id}:unknown`;
        }),
      },
    });
    console.log("🤖 AI System initialized with", allAgents.length, "agents");
    return result;
  } catch (error) {
    console.error("Failed to initialize AI system:", error);
    throw error;
  }
}

const app = new Elysia()
  .get("/service-worker.js", () => {
    return new Response("", { status: 200 });
  })
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
  })
  .onRequest((context) => {
    console.log(
      `[${new Date().toISOString()}] ${context.request.method} ${
        context.request.url
      }`
    );
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
      .use(DistrictMetricsController)
      .use(DepartmentController)
      .use(DistrictController)
      .use(AIController)
      // Class-style controllers with setup method
      .use((app: any) => new AdaptiveLearningController(store).setup(app))
      .use((app: any) =>
        new AIIntegrationController(
          store.services.aiIntegration,
          store.services.cultureService,
          store.services.districtCultureService,
          store.services.agentCultureService
        ).setup(app)
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

// Initialize AI system before starting the server
initializeAISystem()
  .then(() => {
    // Create the server with WebSocket support
    const server = Bun.serve<{ districtId: string; lastActivity: number }>({
      port: process.env.PORT || 3001,
      fetch(req, server) {
        // Handle WebSocket upgrade for district metrics
        if (req.url.includes("/api/districts/") && req.url.includes("/live")) {
          const url = new URL(req.url);
          const districtId = url.pathname.split("/")[3]; // Extract district ID from URL
          const success = server.upgrade(req, {
            data: { districtId, lastActivity: Date.now() },
          });
          return success
            ? undefined
            : new Response("WebSocket upgrade failed", { status: 500 });
        }

        // Handle regular HTTP requests through Elysia
        return app.handle(req);
      },
      websocket: {
        open(ws) {
          try {
            const districtId = ws.data.districtId;
            console.log(
              `WebSocket connection opened for district: ${districtId}`
            );
            store.services.districtWebSocket.handleConnection(ws, districtId);
          } catch (error) {
            console.error("Error in WebSocket connection:", error);
            ws.close();
          }
        },
        message(ws, message) {
          console.log("Received message:", message);
        },
        close(ws) {
          console.log("WebSocket connection closed");
        },
      },
    });

    console.log(
      `🦊 AI City server is running at ${server.hostname}:${server.port}`
    );
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

export type App = typeof app;
