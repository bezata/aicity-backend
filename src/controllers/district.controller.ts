import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import type { District, LocalEvent } from "../types/district.types";
import { CityEventCategory } from "../types/city-events";
import { TransportType } from "../types/transport.types";

// Add this type to match vector store types
type VectorStoreType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport";

interface WebSocketContext {
  store: AppStore;
  params: {
    districtId: string;
  };
  agentId?: string;
  lastActivity?: number;
}

interface EventBody {
  category: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
}

interface TransportHub {
  name: string;
  type: TransportType;
  location: {
    lat: number;
    lng: number;
  };
  capacity: number;
}

interface Interaction {
  agentId: string;
  type: string;
  data: Record<string, any>;
}

interface Memory {
  content: string;
  type: VectorStoreType;
  metadata: Record<string, any>;
}

interface InteractionBody {
  agentId1: string;
  agentId2: string;
  content: string;
}

interface UpdateDistrictsBody {
  districts: District[];
}

export const createDistrictController = (app: Elysia) => {
  app.group("/districts", (app) =>
    app
      .get("/", async ({ store }) => {
        const appStore = store as AppStore;
        try {
          const districts =
            await appStore.services.districtService.getAllDistricts();
          return { success: true, data: districts };
        } catch (error: any) {
          throw error;
        }
      })
      .get("/:districtId", async ({ params: { districtId }, store }) => {
        const appStore = store as AppStore;
        try {
          const district = await appStore.services.districtService.getDistrict(
            districtId
          );
          return { success: true, data: district };
        } catch (error: any) {
          throw error;
        }
      })
      .post(
        "/:districtId/events",
        async ({ params: { districtId }, body, store }) => {
          const appStore = store as AppStore;
          const eventBody = body as EventBody;
          try {
            const event =
              await appStore.services.districtService.addEventToDistrict(
                districtId,
                {
                  ...eventBody,
                  category: mapToCityEventCategory(eventBody.category),
                }
              );
            return { success: true, data: event };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .get(
        "/:districtId/analytics",
        async ({ params: { districtId }, store }) => {
          const appStore = store as AppStore;
          try {
            const analytics =
              await appStore.services.districtService.getDistrictAnalytics(
                districtId
              );
            return { success: true, data: analytics };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .post(
        "/:districtId/transport-hubs",
        async ({ params: { districtId }, body, store }) => {
          const appStore = store as AppStore;
          const hubBody = body as TransportHub;
          try {
            const hub = await appStore.services.districtService.addTransportHub(
              districtId,
              hubBody
            );
            return { success: true, data: hub };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .get(
        "/:districtId/conversations",
        async ({ params: { districtId }, store }) => {
          const appStore = store as AppStore;
          try {
            const conversations =
              await appStore.services.districtService.getDistrictConversations(
                districtId
              );
            return { success: true, data: conversations };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .post(
        "/:districtId/interactions",
        async ({ body, params: { districtId }, store }) => {
          const appStore = store as AppStore;
          const { agentId1, agentId2, content } = body as InteractionBody;
          try {
            const interaction =
              await appStore.services.collaborationService.recordAgentInteraction(
                agentId1,
                agentId2,
                content
              );
            return { success: true, data: interaction };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .post(
        "/:districtId/memories",
        async ({ body, params: { districtId }, store }) => {
          const appStore = store as AppStore;
          const memoryBody = body as Memory;
          try {
            const memory =
              await appStore.services.cityMemory.storeCollectiveMemory({
                type: memoryBody.type as any,
                description: memoryBody.content,
                districtId,
                timestamp: Date.now(),
                emotionalImpact: 0.7,
                participants: [],
                culturalSignificance: 0.7,
              });
            return { success: true, data: memory };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .get(
        "/:districtId/memories",
        async ({ params: { districtId }, query, store }) => {
          const appStore = store as AppStore;
          try {
            const memories =
              await appStore.services.cityMemory.getDistrictMemories(
                districtId,
                {
                  type: query.type as any,
                }
              );
            return { success: true, data: memories };
          } catch (error: any) {
            throw error;
          }
        }
      )
      .ws("/chat", {
        open: async (ws) => {
          const store = ws.data.store as AppStore;
          console.log("🌟 WebSocket Chat Connected");

          // Start initial conversation with random agents
          const allAgents = Array.from(
            store.services.agentConversationService
              .getRegisteredAgents()
              .values()
          );
          const randomAgents = allAgents
            .sort(() => Math.random() - 0.5)
            .slice(0, 3); // Get 3 random agents

          const defaultDistrictId = "a42ed892-3878-45a5-9a1a-4ceaf9524f1c";

          // Start conversation
          const context = {
            districtId: defaultDistrictId,
            activity: "community_discussion",
            culturalContext:
              await store.services.cultureService.getDistrictCulture(
                defaultDistrictId
              ),
            socialMood: {
              positivity: 0.7,
              engagement: 0.7,
            },
          };

          // Start conversation between agents
          const conversation =
            await store.services.agentConversationService.startNewConversation(
              randomAgents.map((agent) => agent.id),
              context
            );

          // Send initial data
          ws.send(
            JSON.stringify({
              type: "chat_started",
              data: {
                agents: randomAgents.map((agent) => ({
                  id: agent.id,
                  name: agent.name,
                  role: agent.role,
                  personality: agent.personality,
                })),
                conversation: {
                  id: conversation.id,
                  topic: conversation.topic,
                  location: conversation.location,
                  messages: conversation.messages.map((msg) => ({
                    id: msg.id,
                    content: msg.content,
                    agentName: store.services.agentConversationService.getAgent(
                      msg.agentId
                    )?.name,
                    agentRole: store.services.agentConversationService.getAgent(
                      msg.agentId
                    )?.role,
                    timestamp: msg.timestamp,
                  })),
                },
              },
            })
          );

          // Set up interval to generate new messages
          const chatInterval = setInterval(async () => {
            try {
              // Get a random agent to speak
              const speaker =
                randomAgents[Math.floor(Math.random() * randomAgents.length)];

              // Generate a response
              const response =
                await store.services.agentConversationService.generateRandomResponse(
                  defaultDistrictId,
                  speaker.id,
                  "Continue the conversation naturally"
                );

              // Send the new message
              ws.send(
                JSON.stringify({
                  type: "new_message",
                  data: {
                    agentId: speaker.id,
                    agentName: speaker.name,
                    agentRole: speaker.role,
                    content: response,
                    timestamp: Date.now(),
                  },
                })
              );
            } catch (error) {
              console.error("Error generating chat:", error);
            }
          }, 5000); // Generate new message every 5 seconds

          // Clean up on close
        },

        message: async (ws, message) => {
          try {
            const data =
              typeof message === "string" ? JSON.parse(message) : message;
            const store = ws.data.store as AppStore;
            const defaultDistrictId = "a42ed892-3878-45a5-9a1a-4ceaf9524f1c";

            if (data.type === "user_message") {
              // Get 2 random agents to respond
              const agents = Array.from(
                store.services.agentConversationService
                  .getRegisteredAgents()
                  .values()
              )
                .sort(() => Math.random() - 0.5)
                .slice(0, 2);

              // Generate responses
              for (const agent of agents) {
                const response =
                  await store.services.agentConversationService.generateRandomResponse(
                    defaultDistrictId,
                    agent.id,
                    data.content
                  );

                ws.send(
                  JSON.stringify({
                    type: "agent_response",
                    data: {
                      agentId: agent.id,
                      agentName: agent.name,
                      agentRole: agent.role,
                      content: response,
                      timestamp: Date.now(),
                    },
                  })
                );
              }
            }
          } catch (error) {
            console.error("Error handling message:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to process message",
              })
            );
          }
        },

        close: (ws) => {
          console.log("WebSocket Chat Closed");
        },
      })
      .post("/update", async ({ body, store }) => {
        const appStore = store as AppStore;
        const updateBody = body as UpdateDistrictsBody;
        try {
          const updatedDistricts =
            await appStore.services.districtService.updateDistrictsFromData(
              updateBody.districts
            );
          return { success: true, data: updatedDistricts };
        } catch (error: any) {
          console.error("Error updating districts:", error);
          throw error;
        }
      })
  );

  return app;
};

function generateSchedule(
  startTime: string,
  endTime: string,
  frequency: number
): string[] {
  const schedule: string[] = [];
  let current = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);

  while (current < end) {
    schedule.push(current.toTimeString().slice(0, 5));
    current.setMinutes(current.getMinutes() + frequency);
  }

  return schedule;
}

// Helper function to map controller categories to CityEventCategory
function mapToCityEventCategory(category: string): CityEventCategory {
  const categoryMap: Record<string, CityEventCategory> = {
    community: "community",
    emergency: "emergency",
    development: "development",
    cultural: "cultural",
    social: "social",
    transport: "transport",
    environmental: "environmental",
  };

  return categoryMap[category] || "community";
}
