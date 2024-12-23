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
          boundaries: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
          ] as Array<[number, number]>,
          area: 0,
          currentEvents: [],
          transportHubs: [],
          residentAgents: [],
          visitorAgents: [],
          amenities: {
            schools: 0,
            hospitals: 0,
            parks: 0,
            shops: 0,
          },
          metrics: {
            education: 0.8,
            healthcare: 0.7,
            environment: 0.6,
            safety: 0.8,
            cleanliness: 0.7,
            noise: 0.3,
            crowding: 0.4,
            ambiance: 0.5,
            economicGrowth: 0.6,
            propertyValues: 0.7,
            businessActivity: 0.6,
            infrastructureQuality: 0.7,
            publicServiceAccess: 0.6,
            transportEfficiency: 0.7,
            culturalVibrancy: 0.8,
            communityWellbeing: 0.7,
            socialCohesion: 0.8,
            energyEfficiency: 0.7,
            greenSpaceCoverage: 0.6,
            environmentalHealth: 0.7,
          },
          socialMetrics: {
            communityEngagement: 0.7,
            culturalDiversity: 0.8,
            socialCohesion: 0.75,
            publicServices: 0.7,
            index: 0.75,
          },
          economicMetrics: {
            employmentRate: 0.85,
            averageIncome: 65000,
            businessActivity: 0.8,
            employment: 0.85,
            index: 0.8,
          },
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
        const scheduleData = {
          weekday: generateSchedule(
            body.schedule.startTime,
            body.schedule.endTime,
            body.schedule.frequency
          ),
          weekend: generateSchedule(
            body.schedule.startTime,
            body.schedule.endTime,
            body.schedule.frequency * 1.5
          ),
          holidays: [],
        };

        const hub = await appStore.services.districtService.addTransportHub(
          id,
          {
            type: body.type,
            capacity: body.capacity,
            schedule: scheduleData,
          }
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
  .post(
    "/:id/memories",
    async ({ body, params: { id }, store }) => {
      const appStore = store as AppStore;
      try {
        const memory = {
          type: body.type as
            | "environmental"
            | "cultural"
            | "social"
            | "historical",
          description: body.description,
          districtId: id,
          timestamp: Date.now(),
          emotionalImpact: body.emotionalImpact,
          participants: body.participants,
          culturalSignificance: body.culturalSignificance,
          tags: body.tags,
          location: body.coordinates
            ? {
                coordinates: [body.coordinates[0], body.coordinates[1]] as [
                  number,
                  number
                ],
                landmark: body.landmark,
              }
            : undefined,
        };

        await appStore.services.cityMemory.storeCollectiveMemory(memory);

        return {
          success: true,
          message: "Memory stored successfully",
          data: memory,
        };
      } catch (error) {
        console.error("Failed to store memory:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("environmental"),
          t.Literal("cultural"),
          t.Literal("social"),
          t.Literal("historical"),
        ]),
        description: t.String(),
        emotionalImpact: t.Number(),
        participants: t.Array(t.String()),
        culturalSignificance: t.Number(),
        tags: t.Optional(t.Array(t.String())),
        coordinates: t.Optional(t.Array(t.Number())),
        landmark: t.Optional(t.String()),
      }),
    }
  )
  .get("/:id/memories", async ({ params: { id }, query, store }) => {
    const appStore = store as AppStore;
    try {
      const memories = await appStore.services.cityMemory.getDistrictMemories(
        id,
        {
          type: query.type as
            | "environmental"
            | "cultural"
            | "social"
            | "historical"
            | undefined,
          fromTimestamp: query.fromTimestamp
            ? parseInt(query.fromTimestamp)
            : undefined,
          toTimestamp: query.toTimestamp
            ? parseInt(query.toTimestamp)
            : undefined,
          minSignificance: query.minSignificance
            ? parseFloat(query.minSignificance)
            : undefined,
          includedTags: query.includedTags
            ? query.includedTags.split(",")
            : undefined,
          excludedTags: query.excludedTags
            ? query.excludedTags.split(",")
            : undefined,
        }
      );
      return { success: true, data: memories };
    } catch (error) {
      console.error(`Failed to fetch memories for district ${id}:`, error);
      throw error;
    }
  })
  .onError(({ code, error }) => {
    return {
      success: false,
      error: error.message,
      code,
    };
  });

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
