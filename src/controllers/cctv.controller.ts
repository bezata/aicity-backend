import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
// TODO: ACTIVITES LL BE GENERATED ON THE INFO OF ANOTHER AGENTS SITUATION AND TOGETHERSERVICE
const activities = [
  "is sleeping peacefully",
  "is brushing their teeth",
  "is having breakfast",
  "is reading a book",
  "is working on city improvements",
  "is analyzing district data",
  "is chatting with citizens",
  "is monitoring traffic patterns",
  "is inspecting infrastructure",
  "is attending a community meeting",
];

export const CCTVController = new Elysia({ prefix: "/cctv" }).post(
  "/observe/:agentId",
  async ({ params: { agentId }, store }) => {
    const appStore = store as AppStore;
    try {
      // Get agent's current location
      const embedding = await appStore.services.vectorStore.createEmbedding(
        `agent ${agentId} location`
      );

      const locationQuery = await appStore.services.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $in: ["agent_residence", "agent_visit"] },
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

      // Generate contextual activity based on time and location
      const hour = new Date().getHours();
      let activity = "";

      if (hour >= 22 || hour < 6) {
        activity = "is sleeping peacefully";
      } else {
        activity = activities[Math.floor(Math.random() * activities.length)];
      }

      const narrative = district
        ? `Agent ${agentId} ${activity} in the ${district.name} district`
        : `Agent ${agentId} ${activity}`;

      // Store observation in vector DB
      await appStore.services.vectorStore.upsert({
        id: `observation-${agentId}-${Date.now()}`,
        values: await appStore.services.vectorStore.createEmbedding(narrative),
        metadata: {
          type: "district",
          agentId,
          activity,
          districtId: district?.id,
          timestamp: Date.now(),
        },
      });

      return {
        success: true,
        data: {
          narrative,
          timestamp: Date.now(),
          location: district?.name || "unknown",
        },
      };
    } catch (error) {
      console.error("Failed to observe agent:", error);
      throw error;
    }
  }
);
