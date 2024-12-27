import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import type { AppStore } from "../services/app.services";

interface ObservationMetadata {
  narrative: string;
  timestamp: number;
  districtId: string;
  safety?: number;
  activity?: number;
}

const ObservationResponse = t.Object({
  success: t.Boolean(),
  data: t.Object({
    narrative: t.String(),
    timestamp: t.Number(),
    location: t.String(),
    metrics: t.Object({
      safety: t.Optional(t.Number()),
      activity: t.Optional(t.Number()),
    }),
    area: t.String(),
  }),
});

const ObservationHistoryResponse = t.Object({
  success: t.Boolean(),
  data: t.Array(
    t.Object({
      narrative: t.String(),
      timestamp: t.Number(),
      location: t.String(),
      metrics: t.Object({
        safety: t.Optional(t.Number()),
        activity: t.Optional(t.Number()),
      }),
    })
  ),
});

const generateCCTVPrompt = (agentId: string, context: string) => `
[CCTV SURVEILLANCE LOG]
Camera: AI City Surveillance System
Target: Agent ${agentId}
Timestamp: ${new Date().toISOString()}
Context: ${context}

Generate a brief surveillance report describing the target's current activities and behavior. Use present tense, objective language, and focus on observable details. Format as a CCTV operator's log entry.

Report:`;

export const CCTVController = new Elysia({ prefix: "/cctv" })
  .use(
    swagger({
      documentation: {
        tags: [
          {
            name: "CCTV Surveillance",
            description:
              "Endpoints for monitoring and tracking agent activities through CCTV",
          },
        ],
      },
    })
  )
  .post(
    "/observe/:agentId",
    async ({ params: { agentId }, store }) => {
      try {
        const appStore = store as AppStore;
        // Get agent's current location and context
        const embedding = await appStore.services.vectorStore.createEmbedding(
          `agent ${agentId} location and activity`
        );

        const locationQuery = await appStore.services.vectorStore.query({
          vector: embedding,
          filter: {
            type: {
              $in: ["agent_residence", "agent_visit", "agent_activity"],
            },
            agentId: { $eq: agentId },
          },
          topK: 1,
        });

        const location = locationQuery.matches[0]?.metadata;
        const district = location
          ? await appStore.services.districtService.getDistrict(
              location.districtId
            )
          : null;

        // Get agent's current conversation or activity
        const activeConversations =
          await appStore.services.agentConversationService
            .getActiveConversations()
            .catch(() => []);

        const agentActivity = activeConversations.find((conv) =>
          conv.participants.some((p) => p.id === agentId)
        );

        // Generate narrative based on context
        let narrative = "";
        if (agentActivity) {
          const participants = agentActivity.participants
            .filter((p) => p.id !== agentId)
            .map((p) => `Agent ${p.id}`)
            .join(", ");

          narrative = `[CCTV LOG] Target Agent ${agentId} observed in conversation with ${participants}. Topic of discussion: ${
            agentActivity.topic || "city matters"
          }. Monitoring conversation for relevant intel.`;
        } else {
          // Generate contextual activity based on time, location, and district metrics
          const hour = new Date().getHours();
          const districtMetrics = district
            ? await appStore.services.metricsService.getCurrentMetrics(
                district.id
              )
            : null;

          const context = `Location: ${district?.name || "Unknown Sector"}
Time: ${hour}:00 hours
District Safety Level: ${districtMetrics?.safety || "Normal"} 
District Activity Level: ${districtMetrics?.activity || "Moderate"}
Surveillance Area: ${district?.name || "Unclassified"} Sector`;

          narrative = await appStore.services.togetherService.generateText(
            generateCCTVPrompt(agentId, context)
          );
        }

        // Store observation with rich metadata
        await appStore.services.vectorStore.upsert({
          id: `observation-${agentId}-${Date.now()}`,
          values: await appStore.services.vectorStore.createEmbedding(
            narrative
          ),
          metadata: {
            type: "agent_observation",
            agentId,
            districtId: district?.id || "",
            timestamp: Date.now(),
            narrative: narrative.trim(),
            safety: district
              ? (
                  await appStore.services.metricsService.getCurrentMetrics(
                    district.id
                  )
                )?.safety
              : undefined,
            activity: district
              ? (
                  await appStore.services.metricsService.getCurrentMetrics(
                    district.id
                  )
                )?.activity
              : undefined,
            conversationTopic: agentActivity?.topic,
          },
        });

        return {
          success: true,
          data: {
            narrative: narrative.trim(),
            timestamp: Date.now(),
            location: district?.name || "unknown",
            metrics: {
              safety: district
                ? (
                    await appStore.services.metricsService.getCurrentMetrics(
                      district.id
                    )
                  )?.safety
                : undefined,
              activity: district
                ? (
                    await appStore.services.metricsService.getCurrentMetrics(
                      district.id
                    )
                  )?.activity
                : undefined,
            },
            area: district?.name || "Unclassified",
          },
        };
      } catch (error) {
        console.error("Failed to observe agent:", error);
        throw error;
      }
    },
    {
      params: t.Object({
        agentId: t.String(),
      }),
      response: ObservationResponse,
      detail: {
        tags: ["CCTV Surveillance"],
        summary: "Observe an agent through CCTV",
        description: "Get real-time surveillance data for a specific agent",
      },
    }
  )
  .get(
    "/history/:agentId",
    async ({ params: { agentId }, query, store }) => {
      try {
        const appStore = store as AppStore;
        const limit = Number(query?.limit) || 10;

        // Query recent observations for the agent
        const embedding = await appStore.services.vectorStore.createEmbedding(
          `agent ${agentId} recent observations`
        );

        const observations = await appStore.services.vectorStore.query({
          vector: embedding,
          filter: {
            type: { $eq: "agent_observation" },
            agentId: { $eq: agentId },
          },
          topK: limit,
        });

        return {
          success: true,
          data: observations.matches.map(
            (match: { metadata: ObservationMetadata }) => ({
              narrative: match.metadata.narrative,
              timestamp: match.metadata.timestamp,
              location: match.metadata.districtId,
              metrics: {
                safety: match.metadata.safety,
                activity: match.metadata.activity,
              },
            })
          ),
        };
      } catch (error) {
        console.error("Failed to get agent history:", error);
        throw error;
      }
    },
    {
      params: t.Object({
        agentId: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.Numeric()),
      }),
      response: ObservationHistoryResponse,
      detail: {
        tags: ["CCTV Surveillance"],
        summary: "Get agent observation history",
        description:
          "Retrieve historical surveillance data for a specific agent",
      },
    }
  );
