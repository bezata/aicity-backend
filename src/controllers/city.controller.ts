import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import type { WeatherState, CityMood } from "../types/city.types";

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
    "/weather/update",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      await appStore.services.cityService.updateWeather(body);
      return { success: true };
    },
    {
      body: t.Partial(
        t.Object({
          condition: t.Union([
            t.Literal("clear"),
            t.Literal("rain"),
            t.Literal("cloudy"),
            t.Literal("storm"),
          ]),
          temperature: t.Number(),
          humidity: t.Number(),
          windSpeed: t.Number(),
          precipitation: t.Number(),
        })
      ),
    }
  )
  .post(
    "/mood/update",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      await appStore.services.cityService.updateMood(body);
      return { success: true };
    },
    {
      body: t.Partial(
        t.Object({
          happiness: t.Number(),
          stress: t.Number(),
          energy: t.Number(),
          community: t.Number(),
        })
      ),
    }
  )
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
      weather: await appStore.services.cityService.getCurrentWeather(),
      cityMood: await appStore.services.cityService.getCityMood(),
    };
  });
