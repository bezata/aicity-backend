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
      .ws("/:districtId/ws", {
        open: (ws) => {
          const districtId = ws.data.params.districtId;
          const store = ws.data.store as AppStore;
          store.services.districtService.addConnection(districtId, ws as any);
          console.log(`WebSocket opened for district ${districtId}`);

          // Send initial state with active conversations
          store.services.agentConversationService
            .getActiveConversations()
            .then((conversations) => {
              const districtConversations = conversations.filter(
                (conv) => conv.districtId === districtId
              );
              store.services.districtService.broadcastMessage(districtId, {
                type: "connected",
                timestamp: Date.now(),
                data: {
                  activeConversations: districtConversations.map((conv) => ({
                    id: conv.id,
                    participants: conv.participants.map((p) => ({
                      id: p.id,
                      name: p.name,
                      role: p.role,
                    })),
                    messages: conv.messages,
                    topic: conv.topic,
                    location: conv.location,
                    activity: conv.activity,
                    startTime: conv.startTime,
                    status: conv.status,
                    sentiment: conv.sentiment,
                    socialContext: conv.socialContext,
                    culturalContext: conv.culturalContext,
                  })),
                },
              });
            })
            .catch(console.error);
        },
        message: (ws, message) => {
          try {
            const data =
              typeof message === "string" ? JSON.parse(message) : message;
            const districtId = ws.data.params.districtId;
            const store = ws.data.store as AppStore;

            // Handle different message types
            switch (data.type) {
              case "join":
                store.services.districtService.broadcastMessage(districtId, {
                  type: "agent_joined",
                  agentId: data.agentId,
                  timestamp: Date.now(),
                  data: {
                    agent: store.services.agentConversationService.getAgent(
                      data.agentId
                    ),
                  },
                });
                break;

              case "message":
                store.services.districtService.broadcastMessage(districtId, {
                  type: "agent_message",
                  timestamp: Date.now(),
                  data: {
                    conversationId: data.conversationId,
                    message: {
                      id: `msg-${Date.now()}`,
                      agentId: data.agentId,
                      content: data.content,
                      timestamp: Date.now(),
                      role: "assistant",
                    },
                    conversation: store.services.agentConversationService
                      .getActiveConversations()
                      .then((convs) =>
                        convs.find((c) => c.id === data.conversationId)
                      ),
                  },
                });
                break;

              case "leave":
                store.services.districtService.broadcastMessage(districtId, {
                  type: "agent_left",
                  agentId: data.agentId,
                  timestamp: Date.now(),
                  data: {
                    agent: store.services.agentConversationService.getAgent(
                      data.agentId
                    ),
                  },
                });
                break;

              case "get_conversations":
                store.services.agentConversationService
                  .getActiveConversations()
                  .then((conversations) => {
                    const districtConversations = conversations.filter(
                      (conv) => conv.districtId === districtId
                    );
                    ws.send(
                      JSON.stringify({
                        type: "conversations_update",
                        timestamp: Date.now(),
                        data: {
                          conversations: districtConversations.map((conv) => ({
                            id: conv.id,
                            participants: conv.participants.map((p) => ({
                              id: p.id,
                              name: p.name,
                              role: p.role,
                            })),
                            messages: conv.messages,
                            topic: conv.topic,
                            location: conv.location,
                            activity: conv.activity,
                            startTime: conv.startTime,
                            status: conv.status,
                            sentiment: conv.sentiment,
                            socialContext: conv.socialContext,
                            culturalContext: conv.culturalContext,
                          })),
                        },
                      })
                    );
                  })
                  .catch(console.error);
                break;
            }
          } catch (error) {
            console.error("Error handling WebSocket message:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to process message",
                timestamp: Date.now(),
              })
            );
          }
        },
        close: (ws) => {
          const districtId = ws.data.params.districtId;
          const store = ws.data.store as AppStore;
          store.services.districtService.removeConnection(
            districtId,
            ws as any
          );
          console.log(`WebSocket closed for district ${districtId}`);
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
