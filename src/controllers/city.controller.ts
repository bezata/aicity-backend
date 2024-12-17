import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";

export const CityController = new Elysia({ prefix: "/city" })
  .get("/status", async ({ store }) => {
    const appStore = store as AppStore;
    return {
      weather: await appStore.services.cityService.getCurrentWeather(),
      mood: await appStore.services.cityService.getCityMood(),
      activeConversations:
        await appStore.services.conversationService.getConversations(),
      popularTopics: await appStore.services.analyticsService.getTopicTrends(),
    };
  })
  .post(
    "/event",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      await appStore.services.cityService.broadcastEvent(
        body.eventType,
        body.eventData
      );
      return { success: true };
    },
    {
      body: t.Object({
        eventType: t.String(),
        eventData: t.Any(),
      }),
    }
  )
  .get("/analytics", async ({ store }) => {
    const appStore = store as AppStore;
    return {
      topicTrends: await appStore.services.analyticsService.getTopicTrends(),
      agentInteractions:
        await appStore.services.analyticsService.getInteractionStats(),
      moodHistory: await appStore.services.analyticsService.getMoodHistory(),
    };
  });
