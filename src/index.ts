import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import { verifyAuth } from "./middleware/auth";
import { ErrorResponse } from "./types/responses";
import { agents, residentAgents } from "./config/agents";
import { cityManagementAgents, allCityAgents } from "./config/city-agents";
import { ServerWebSocket, Server } from "bun";

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
import { ChroniclesController } from "./controllers/chronicles.controller";
import { CCTVController } from "./controllers/cctv.controller";

type ElysiaInstance = InstanceType<typeof Elysia>;
type ElysiaConfig = Parameters<ElysiaInstance["group"]>[1];
const store = createStore();

// Define WebSocket data type
export interface WebSocketData {
  createdAt: number;
  url: string;
  eventListeners?: Map<string, (...args: any[]) => void>;
  messageHistory: Map<string, { content: string; timestamp: number }>;
  activeConversations: Set<string>; // Track which conversations this connection is subscribed to
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
      .use((app: any) => new ChroniclesController(store).routes(app))
      .use(CCTVController)
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

// Helper function to check for duplicate messages
const isDuplicateMessage = (
  messageHistory: Map<string, { content: string; timestamp: number }>,
  type: string,
  content: string
): boolean => {
  const key = `${type}-${content}`;
  const lastMessage = messageHistory.get(key);
  const now = Date.now();

  if (lastMessage && now - lastMessage.timestamp < 10000) {
    // 10 seconds
    return true;
  }

  // Update history
  messageHistory.set(key, { content, timestamp: now });

  // Clean up old messages
  for (const [key, msg] of messageHistory.entries()) {
    if (now - msg.timestamp > 10000) {
      messageHistory.delete(key);
    }
  }

  return false;
};

// Helper function to send websocket message with duplicate check
const sendWebSocketMessage = (
  ws: ServerWebSocket<WebSocketData>,
  messageHistory: Map<string, { content: string; timestamp: number }>,
  type: string,
  data: any
) => {
  const content = JSON.stringify(data);
  if (!content || content === "{}") return; // Skip empty messages

  if (isDuplicateMessage(messageHistory, type, content)) {
    console.log(`Skipping duplicate message of type: ${type}`);
    return;
  }

  try {
    ws.send(
      JSON.stringify({
        type,
        timestamp: Date.now(),
        data,
      })
    );
  } catch (error) {
    console.error("Failed to send WebSocket message:", error);
  }
};

// Add function to retrieve past conversations
const getPastConversations = async (conversationId: string) => {
  try {
    const query = `conversation-${conversationId}`;
    const embedding = await store.services.vectorStore.createEmbedding(query);

    const results = await store.services.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "conversation" },
        conversationId: { $eq: conversationId },
      },
      topK: 100,
      includeMetadata: true,
    });

    return results.matches.map((match: any) => ({
      content: match.metadata.content,
      agentName: match.metadata.agentName,
      agentRole: match.metadata.agentRole,
      timestamp: parseInt(match.metadata.timestamp),
      sentiment: parseFloat(match.metadata.sentiment || "0"),
      topics: match.metadata.topics?.split(",") || [],
    }));
  } catch (error) {
    console.error("Error retrieving past conversations:", error);
    return [];
  }
};

// Modify sendConversationHistory to include past messages
const sendConversationHistory = async (
  ws: ServerWebSocket<WebSocketData>,
  conversationId: string
) => {
  try {
    const conversation = await store.services.agentConversationService
      .getActiveConversations()
      .then((convs) => convs.find((c) => c.id === conversationId));

    if (!conversation) {
      sendWebSocketMessage(ws, ws.data.messageHistory, "error", {
        message: "Conversation not found",
      });
      return;
    }

    // Get past messages from vector store
    const pastMessages = await getPastConversations(conversationId);

    // Combine current and past messages
    const allMessages = [
      ...pastMessages,
      ...conversation.messages.map((m) => ({
        content: m.content,
        agentName: store.services.agentConversationService.getAgent(m.agentId)
          ?.name,
        agentRole: store.services.agentConversationService.getAgent(m.agentId)
          ?.role,
        timestamp: m.timestamp,
        sentiment: m.sentiment,
        topics: m.topics,
      })),
    ];

    // Sort messages by timestamp
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Send conversation details
    sendWebSocketMessage(ws, ws.data.messageHistory, "conversation_joined", {
      conversationId: conversation.id,
      topic: conversation.topic,
      location: conversation.location,
      activity: conversation.activity,
      participants: conversation.participants.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
      })),
      messages: allMessages,
    });

    // Add conversation to active subscriptions
    ws.data.activeConversations.add(conversationId);
  } catch (error) {
    console.error("Error sending conversation history:", error);
    sendWebSocketMessage(ws, ws.data.messageHistory, "error", {
      message: "Failed to load conversation history",
    });
  }
};

// Modify the broadcastToConversation function to properly await the conversation
const broadcastToConversation = async (
  server: Server,
  conversationId: string,
  type: string,
  data: any
) => {
  // Add location if not present in data
  if (data.location === undefined) {
    const conversations =
      await store.services.agentConversationService.getActiveConversations();
    const conversation = conversations.find((c) => c.id === conversationId);

    if (conversation) {
      data.location = conversation.location;
    }
  }

  server.publish(
    `conversation:${conversationId}`,
    JSON.stringify({
      type,
      timestamp: Date.now(),
      data,
    })
  );
};

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
              messageHistory: new Map<
                string,
                { content: string; timestamp: number }
              >(),
              activeConversations: new Set(),
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

          // Set max listeners for services to prevent warnings
          store.services.agentConversationService.setMaxListeners(20);
          store.services.collaborationService.setMaxListeners(20);
          store.services.donationService.setMaxListeners(20);

          // Send welcome message
          sendWebSocketMessage(ws, ws.data.messageHistory, "connected", {
            message:
              "Connected to AI City Agent Conversations - Send a message to interact with agents!",
          });

          // Store event listeners for cleanup
          const eventListeners = new Map();

          // Listen to donation reactions
          const donationReactionListener = (data: any) => {
            sendWebSocketMessage(
              ws,
              ws.data.messageHistory,
              "donation_reaction",
              {
                announcementId: data.announcementId,
                reaction: data.reaction,
                count: data.count,
                districtId: data.districtId,
              }
            );
          };
          store.services.donationService.on(
            "donationReaction",
            donationReactionListener
          );
          eventListeners.set("donationReaction", donationReactionListener);

          // Listen to donation goal progress
          const donationGoalListener = (data: {
            goal: {
              id: string;
              title: string;
              currentAmount: number;
              targetAmount: number;
            };
            donation: {
              donorName: string;
              amount: number;
            };
            celebrationEvent: {
              title: string;
              description: string;
            };
          }) => {
            // Send goal progress update
            sendWebSocketMessage(
              ws,
              ws.data.messageHistory,
              "donation_goal_progress",
              {
                goalId: data.goal.id,
                title: data.goal.title,
                progress: {
                  current: data.goal.currentAmount,
                  target: data.goal.targetAmount,
                  percentage:
                    (data.goal.currentAmount / data.goal.targetAmount) * 100,
                },
              }
            );

            // If goal is reached, send celebration announcement
            if (data.goal.currentAmount >= data.goal.targetAmount) {
              sendWebSocketMessage(
                ws,
                ws.data.messageHistory,
                "system_message",
                {
                  content:
                    `🎉 Donation Goal Reached! ${data.goal.title}\n` +
                    `Thanks to a generous donation of $${data.donation.amount.toLocaleString()} from ${
                      data.donation.donorName
                    }!\n\n` +
                    `🎊 Upcoming Celebration: ${data.celebrationEvent.title}\n` +
                    `${data.celebrationEvent.description}`,
                }
              );
            }
          };
          store.services.donationService.on(
            "donationGoalReached",
            donationGoalListener
          );
          eventListeners.set("donationGoalReached", donationGoalListener);

          // Listen to agent conversation events
          const messageAddedListener = async (data: any) => {
            if (!data.message?.content) return; // Skip empty messages

            // Get the conversation to access location, activity, and topic
            const conversation = await store.services.agentConversationService
              .getActiveConversations()
              .then((convs) => convs.find((c) => c.id === data.conversationId));

            // Store conversation in vector store
            await store.services.vectorStore.upsert({
              id: `conversation-${data.conversationId}-${Date.now()}`,
              values: await store.services.vectorStore.createEmbedding(
                data.message.content
              ),
              metadata: {
                type: "conversation",
                conversationId: data.conversationId,
                agentId: data.message.agentId,
                agentName: store.services.agentConversationService.getAgent(
                  data.message.agentId
                )?.name,
                agentRole: store.services.agentConversationService.getAgent(
                  data.message.agentId
                )?.role,
                content: data.message.content,
                timestamp: data.message.timestamp,
                sentiment: data.message.sentiment,
                topics: data.message.topics?.join(",") || "",
                location: conversation?.location,
                activity: conversation?.activity,
                topic: conversation?.topic,
              },
            });

            sendWebSocketMessage(
              ws,
              ws.data.messageHistory,
              "agent_conversation",
              {
                conversationId: data.conversationId,
                message: {
                  content: data.message.content,
                  agentName: store.services.agentConversationService.getAgent(
                    data.message.agentId
                  )?.name,
                  agentRole: store.services.agentConversationService.getAgent(
                    data.message.agentId
                  )?.role,
                  timestamp: data.message.timestamp,
                },
                location: conversation?.location,
                activity: conversation?.activity,
                topic: conversation?.topic,
              }
            );
          };
          store.services.agentConversationService.on(
            "message:added",
            messageAddedListener
          );
          eventListeners.set("message:added", messageAddedListener);

          // Listen to collaboration events
          const collaborationStartedListener = (session: any) => {
            sendWebSocketMessage(ws, ws.data.messageHistory, "system_message", {
              content: `🚨 Emergency Collaboration Started: A group of agents is working on solving a city problem. Participating agents: ${session.agents
                .map(
                  (id: string) =>
                    store.services.agentConversationService.getAgent(id)?.name
                )
                .join(", ")}`,
            });
          };
          store.services.collaborationService.on(
            "collaborationStarted",
            collaborationStartedListener
          );
          eventListeners.set(
            "collaborationStarted",
            collaborationStartedListener
          );

          // Listen to collaboration completion
          const collaborationCompletedListener = async (data: any) => {
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
              sendWebSocketMessage(
                ws,
                ws.data.messageHistory,
                "system_message",
                {
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
                }
              );
            }
          };
          store.services.collaborationService.on(
            "collaborationCompleted",
            collaborationCompletedListener
          );
          eventListeners.set(
            "collaborationCompleted",
            collaborationCompletedListener
          );

          // Listen to collaboration failures
          const collaborationFailedListener = (data: any) => {
            sendWebSocketMessage(ws, ws.data.messageHistory, "system_message", {
              content:
                `❌ Collaboration Failed\n` +
                `📋 Topic: ${data.topic}\n` +
                `❗ Reason: ${data.reason}\n` +
                `🔄 Status: The department will reassess and try again with adjusted parameters.`,
            });
          };
          store.services.collaborationService.on(
            "collaborationFailed",
            collaborationFailedListener
          );
          eventListeners.set(
            "collaborationFailed",
            collaborationFailedListener
          );

          // Listen to new donations
          const donationProcessedListener = async (data: {
            donation: {
              donorName: string;
              amount: number;
              purpose: string;
              districtId: string;
            };
          }) => {
            const { donation } = data;
            sendWebSocketMessage(ws, ws.data.messageHistory, "system_message", {
              content: `💝 New Donation Alert!\n${
                donation.donorName
              } has donated $${donation.amount.toLocaleString()} for ${
                donation.purpose
              }`,
            });

            // Make agents react to the donation
            try {
              const agents =
                store.services.agentConversationService.getRegisteredAgents();
              const nearbyAgents = Array.from(agents.values())
                .filter((agent) => agent.districtId === donation.districtId)
                .slice(0, 3);

              if (nearbyAgents.length > 0) {
                // Start a new conversation about the donation
                const conversation =
                  await store.services.agentConversationService.startNewConversation(
                    nearbyAgents.map((agent) => agent.id),
                    {
                      districtId: donation.districtId,
                      activity: "discussing_donation",
                      socialMood: {
                        positivity: 0.8,
                        engagement: 0.7,
                      },
                      culturalContext: {
                        events: [],
                        traditions: [],
                      },
                    }
                  );

                // Let the first agent react through the conversation system
                const message = `I just heard about the generous donation from ${
                  donation.donorName
                }! They've contributed $${donation.amount.toLocaleString()} for ${
                  donation.purpose
                }. This will really help our community!`;

                // Use the conversation system to handle the message
                await store.services.agentConversationService.handleUserMessage(
                  conversation.id,
                  message
                );
              }
            } catch (error) {
              console.error(
                "Error creating agent reaction to donation:",
                error
              );
            }
          };

          store.services.donationService.on(
            "donationProcessed",
            donationProcessedListener
          );
          eventListeners.set("donationProcessed", donationProcessedListener);

          // Store event listeners in WebSocket data for cleanup
          ws.data.eventListeners = eventListeners;
        },
        message: async (ws, message) => {
          try {
            console.log("Raw message received:", String(message));
            // Clean up the message by removing whitespace and normalizing
            const cleanMessage = String(message)
              .replace(/\s+/g, " ") // Replace multiple whitespace with single space
              .replace(/\n/g, "") // Remove newlines
              .trim(); // Remove leading/trailing whitespace

            console.log("Cleaned message:", cleanMessage);
            const data = JSON.parse(cleanMessage);
            console.log("Parsed message:", data);

            if (data.type === "join_conversation") {
              console.log("👥 User joining conversation:", data.conversationId);
              // First check if conversation exists
              const conversation = await store.services.agentConversationService
                .getActiveConversations()
                .then((convs) =>
                  convs.find((c) => c.id === data.conversationId)
                );

              if (!conversation) {
                console.log("❌ Conversation not found:", data.conversationId);
                sendWebSocketMessage(ws, ws.data.messageHistory, "error", {
                  message: "Conversation not found or no longer active",
                });
                return;
              }

              console.log(
                "Found conversation:",
                conversation.id,
                "with",
                conversation.participants.length,
                "participants"
              );
              await sendConversationHistory(ws, data.conversationId);
              // Subscribe to conversation updates
              ws.subscribe(`conversation:${data.conversationId}`);
            } else if (data.type === "leave_conversation") {
              console.log("👋 User leaving conversation:", data.conversationId);
              ws.data.activeConversations.delete(data.conversationId);
              ws.unsubscribe(`conversation:${data.conversationId}`);
              sendWebSocketMessage(
                ws,
                ws.data.messageHistory,
                "conversation_left",
                {
                  conversationId: data.conversationId,
                }
              );
            } else if (data.type === "user_message") {
              console.log("👤 User sent message:", data.content);

              try {
                if (data.conversationId) {
                  // If message is in a conversation, use the new handleUserMessage method
                  await store.services.agentConversationService.handleUserMessage(
                    data.conversationId,
                    data.content
                  );
                } else {
                  // For messages outside conversations, keep existing random agent selection logic
                  const allAgents = Array.from(
                    store.services.agentConversationService
                      .getRegisteredAgents()
                      .values()
                  );
                  const respondingAgents = allAgents
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 2 + Math.floor(Math.random() * 2));

                  console.log(
                    "🤖 Selected random agents for response:",
                    respondingAgents.map((agent) => agent.name)
                  );

                  // Get responses from each agent
                  for (const agent of respondingAgents) {
                    const response =
                      await store.services.agentConversationService.generateRandomResponse(
                        "a42ed892-3878-45a5-9a1a-4ceaf9524f1c",
                        agent.id,
                        data.content
                      );

                    if ("error" in response) {
                      console.error(
                        "Error generating response:",
                        response.error
                      );
                      continue;
                    }

                    const messageData = {
                      agentId: agent.id,
                      agentName: agent.name,
                      agentRole: agent.role,
                      personality: agent.personality,
                      content: response.response,
                      replyTo: data.content,
                      conversationId: response.conversationId,
                    };

                    // Send directly to this connection
                    sendWebSocketMessage(
                      ws,
                      ws.data.messageHistory,
                      "agent_response",
                      messageData
                    );

                    // Add small delay between responses
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                  }
                }
              } catch (error) {
                console.error("Error handling user message:", error);
                sendWebSocketMessage(ws, ws.data.messageHistory, "error", {
                  message: "Failed to process user message",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                });
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
            console.error("Error handling WebSocket message:", error);
          }
        },
        close(ws) {
          console.log(`WebSocket closed for ${ws.data.url}`);

          // Unsubscribe from all conversations
          for (const conversationId of ws.data.activeConversations) {
            ws.unsubscribe(`conversation:${conversationId}`);
          }
          ws.data.activeConversations.clear();

          // Clean up event listeners
          if (ws.data.eventListeners) {
            for (const [event, listener] of ws.data.eventListeners.entries()) {
              if (event === "donationReaction") {
                store.services.donationService.off(
                  "donationReaction",
                  listener
                );
              } else if (event === "message:added") {
                store.services.agentConversationService.off(
                  "message:added",
                  listener
                );
              } else if (
                [
                  "collaborationStarted",
                  "collaborationCompleted",
                  "collaborationFailed",
                ].includes(event)
              ) {
                store.services.collaborationService.off(event, listener);
              }
            }
          }
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
