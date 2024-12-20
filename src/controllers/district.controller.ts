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

export const DistrictController = new Elysia({ prefix: "/districts" })
  .get("/", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const districts =
        await appStore.services.districtService.getAllDistricts();
      return { success: true, data: districts };
    } catch (error) {
      console.error("Failed to fetch districts:", error);
      throw error;
    }
  })
  .post(
    "/",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const district: District = {
          id: crypto.randomUUID(),
          name: body.name,
          type: body.type,
          population: body.population,
          density: 0,
          economicActivity: 0,
          coordinates: [0, 0],
          currentEvents: [],
          transportHubs: [],
          residentAgents: [],
          visitorAgents: [],
          metrics: {
            noise: 0.3,
            crowding: 0.4,
            safety: 0.8,
            cleanliness: 0.7,
            ambiance: 0.5,
          },
          schedules: [],
        };

        await appStore.services.districtService.addDistrict(district);
        return { success: true, data: district };
      } catch (error) {
        console.error("Failed to create district:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        name: t.String(),
        type: t.Union([
          t.Literal("residential"),
          t.Literal("commercial"),
          t.Literal("industrial"),
          t.Literal("mixed"),
        ]),
        population: t.Number(),
      }),
    }
  )
  .get("/:id", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    try {
      const district = await appStore.services.districtService.getDistrict(id);
      if (!district) throw new Error("District not found");
      return { success: true, data: district };
    } catch (error) {
      console.error(`Failed to fetch district ${id}:`, error);
      throw error;
    }
  })
  .post(
    "/:id/events",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      try {
        const event =
          await appStore.services.districtService.addEventToDistrict(id, body);
        return { success: true, data: event };
      } catch (error) {
        console.error(`Failed to add event to district ${id}:`, error);
        throw error;
      }
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.String(),
        category: t.Union([
          t.Literal("urban_development"),
          t.Literal("transportation"),
          t.Literal("environmental"),
          t.Literal("infrastructure"),
          t.Literal("community"),
          t.Literal("emergency"),
          t.Literal("cultural"),
          t.Literal("health"),
          t.Literal("education"),
          t.Literal("technology"),
        ]),
        severity: t.Number(),
        duration: t.Number(),
        impact: t.Object({
          environmental: t.Number(),
          social: t.Number(),
          economic: t.Number(),
        }),
        requiredAgents: t.Array(t.String()),
      }),
    }
  )
  .get("/:id/analytics", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    try {
      const analytics =
        await appStore.services.districtService.getDistrictAnalytics(id);
      return { success: true, data: analytics };
    } catch (error) {
      console.error(`Failed to fetch analytics for district ${id}:`, error);
      throw error;
    }
  })
  .post(
    "/:id/transport-hubs",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      try {
        const hub = await appStore.services.districtService.addTransportHub(
          id,
          body
        );
        return { success: true, data: hub };
      } catch (error) {
        console.error(`Failed to add transport hub to district ${id}:`, error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("bus"),
          t.Literal("train"),
          t.Literal("subway"),
        ]),
        capacity: t.Number(),
        schedule: t.Object({
          frequency: t.Number(),
          startTime: t.String(),
          endTime: t.String(),
        }),
      }),
    }
  )
  .get("/:id/conversations", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    try {
      // Get recent conversations in this district
      const embedding = await appStore.services.vectorStore.createEmbedding(
        `district ${id} conversations`
      );

      const conversations = await appStore.services.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $eq: "district" as VectorStoreType },
          districtId: { $eq: id },
        },
        topK: 10,
      });

      return { success: true, data: conversations.matches };
    } catch (error) {
      console.error(`Failed to fetch district conversations:`, error);
      throw error;
    }
  })
  .post(
    "/:id/interactions",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      try {
        const { agentId1, agentId2, content } = body;

        // Record interaction in vector store
        const embedding = await appStore.services.vectorStore.createEmbedding(
          content
        );

        await appStore.services.vectorStore.upsert({
          id: `interaction-${Date.now()}`,
          values: embedding,
          metadata: {
            type: "district" as VectorStoreType,
            districtId: id,
            agents: [agentId1, agentId2],
            content,
            timestamp: Date.now(),
          },
        });

        return { success: true };
      } catch (error) {
        console.error(`Failed to record interaction:`, error);
        throw error;
      }
    },
    {
      body: t.Object({
        agentId1: t.String(),
        agentId2: t.String(),
        content: t.String(),
      }),
    }
  )
  .onError(({ code, error }) => {
    return {
      success: false,
      error: error.message,
      code,
    };
  });
