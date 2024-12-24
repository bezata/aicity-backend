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
import { createDistrictController } from "./controllers/district.controller";
import { DonationController } from "./controllers/donation.controller";
import { DistrictMetricsController } from "./controllers/district-metrics.controller";
import { AgentCollaborationController } from "./controllers/agent-collaboration.controller";

type ElysiaInstance = InstanceType<typeof Elysia>;
type ElysiaConfig = Parameters<ElysiaInstance["group"]>[1];
const store = createStore();

// Define WebSocket data type
interface WebSocketData {
  createdAt: number;
  url: string;
}

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
      .use(createDistrictController)
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
      .use(AgentCollaborationController)
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
    const server = Bun.serve<WebSocketData>({
      port: process.env.PORT || 3001,
      fetch(req, server) {
        const url = new URL(req.url);
        const isWebSocket = url.pathname.includes("/ws");

        if (isWebSocket) {
          const upgraded = server.upgrade(req, {
            data: {
              createdAt: Date.now(),
              url: url.pathname,
            },
          });

          if (!upgraded) {
            return new Response("WebSocket upgrade failed", { status: 400 });
          }
          return;
        }

        return app.handle(req);
      },
      websocket: {
        open(ws) {
          console.log(`🌟 WebSocket connected to ${ws.data.url}`);

          // Subscribe to agent conversations
          ws.subscribe("agent_conversations");

          // Send welcome message
          ws.send(
            JSON.stringify({
              type: "connected",
              timestamp: Date.now(),
              message:
                "Connected to AI City Agent Conversations - Send a message to interact with agents!",
            })
          );

          // Listen to donation reactions
          store.services.donationService.on("donationReaction", (data) => {
            ws.send(
              JSON.stringify({
                type: "donation_reaction",
                timestamp: Date.now(),
                data: {
                  announcementId: data.announcementId,
                  reaction: data.reaction,
                  count: data.count,
                  districtId: data.districtId,
                },
              })
            );
          });

          // Listen to agent conversation events
          store.services.agentConversationService.on(
            "message:added",
            (data) => {
              ws.send(
                JSON.stringify({
                  type: "agent_conversation",
                  timestamp: Date.now(),
                  data: {
                    conversationId: data.conversationId,
                    message: {
                      content: data.message.content,
                      agentName:
                        store.services.agentConversationService.getAgent(
                          data.message.agentId
                        )?.name,
                      agentRole:
                        store.services.agentConversationService.getAgent(
                          data.message.agentId
                        )?.role,
                      timestamp: data.message.timestamp,
                    },
                  },
                })
              );
            }
          );

          // Listen to collaboration events
          store.services.collaborationService.on(
            "collaborationStarted",
            (session) => {
              ws.send(
                JSON.stringify({
                  type: "system_message",
                  timestamp: Date.now(),
                  data: {
                    content: `🚨 Emergency Collaboration Started: A group of agents is working on solving a city problem. Participating agents: ${session.agents
                      .map(
                        (id: string) =>
                          store.services.agentConversationService.getAgent(id)
                            ?.name
                      )
                      .join(", ")}`,
                  },
                })
              );
            }
          );

          // Listen to collaboration completion
          store.services.collaborationService.on(
            "collaborationCompleted",
            async (data) => {
              const department =
                await store.services.departmentService.getDepartment(
                  data.departmentId
                );
              if (department) {
                // Update department metrics
                department.metrics.collaborationScore = Math.min(
                  1,
                  department.metrics.collaborationScore + 0.1
                );
                department.metrics.efficiency = Math.min(
                  1,
                  department.metrics.efficiency + 0.05
                );

                // Send system message about completion
                ws.send(
                  JSON.stringify({
                    type: "system_message",
                    timestamp: Date.now(),
                    data: {
                      content:
                        `✨ Collaboration Successfully Completed!\n` +
                        `🎯 Topic: ${data.topic}\n` +
                        `📊 Impact:\n` +
                        `- Community Impact: ${data.impact.social * 100}%\n` +
                        `- Economic Growth: ${data.impact.economic * 100}%\n` +
                        `- Environmental Benefit: ${
                          data.impact.environmental * 100
                        }%\n` +
                        `📈 Department Metrics:\n` +
                        `- Collaboration Score: ${(
                          department.metrics.collaborationScore * 100
                        ).toFixed(1)}%\n` +
                        `- Efficiency: ${(
                          department.metrics.efficiency * 100
                        ).toFixed(1)}%`,
                    },
                  })
                );
              }
            }
          );

          // Listen to collaboration failures
          store.services.collaborationService.on(
            "collaborationFailed",
            (data) => {
              ws.send(
                JSON.stringify({
                  type: "system_message",
                  timestamp: Date.now(),
                  data: {
                    content:
                      `❌ Collaboration Failed\n` +
                      `📋 Topic: ${data.topic}\n` +
                      `❗ Reason: ${data.reason}\n` +
                      `🔄 Status: The department will reassess and try again with adjusted parameters.`,
                  },
                })
              );
            }
          );
        },
        message: async (ws, message) => {
          try {
            const data = JSON.parse(String(message));
            console.log("📩 Received message:", data);

            if (data.type === "user_message") {
              console.log("👤 User sent message:", data.content);

              // Get 2-3 random agents to respond
              const allAgents = Array.from(
                store.services.agentConversationService
                  .getRegisteredAgents()
                  .values()
              );
              const respondingAgents = allAgents
                .sort(() => Math.random() - 0.5)
                .slice(0, 2 + Math.floor(Math.random() * 2));

              console.log(
                "🤖 Selected agents for response:",
                respondingAgents.map((a) => a.name)
              );

              // Get responses from each agent
              for (const agent of respondingAgents) {
                const response =
                  await store.services.agentConversationService.generateRandomResponse(
                    "a42ed892-3878-45a5-9a1a-4ceaf9524f1c",
                    agent.id,
                    data.content
                  );

                ws.send(
                  JSON.stringify({
                    type: "agent_response",
                    timestamp: Date.now(),
                    data: {
                      agentId: agent.id,
                      agentName: agent.name,
                      agentRole: agent.role,
                      personality: agent.personality,
                      content: response,
                      replyTo: data.content,
                    },
                  })
                );

                // Add small delay between responses
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            } else if (data.type === "add_reaction") {
              console.log("👍 Adding reaction:", data);

              if (data.announcementId && data.reaction) {
                await store.services.donationService.addReactionToAnnouncement(
                  data.announcementId,
                  data.reaction
                );
              }
            }
          } catch (error) {
            console.error("Error handling message:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                timestamp: Date.now(),
                message: "Failed to process message",
                error: (error as Error).message,
              })
            );
          }
        },
        close(ws) {
          console.log(`WebSocket closed for ${ws.data.url}`);
          ws.unsubscribe("agent_conversations");
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
