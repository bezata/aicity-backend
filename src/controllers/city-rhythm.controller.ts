import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { AppStore } from "../services/app.services";

// Schema definitions
const ActivityPattern = t.Object({
  hour: t.Number({ minimum: 0, maximum: 23 }),
  type: t.Union([
    t.Literal("transport"),
    t.Literal("business"),
    t.Literal("leisure"),
    t.Literal("social"),
  ]),
  intensity: t.Number({ minimum: 0, maximum: 1 }),
  locations: t.Array(t.String()),
});

const ActivityType = t.Union([
  t.Literal("transport"),
  t.Literal("business"),
  t.Literal("leisure"),
  t.Literal("social"),
]);

export const CityRhythmController = ({ store }: { store: AppStore }) =>
  new Elysia({ prefix: "/rhythm" })
    .get(
      "/current",
      async () => {
        try {
          const patterns = await store.services.cityRhythm.getCurrentPatterns();
          return {
            success: true,
            data: patterns,
          };
        } catch (error) {
          console.error("Failed to get current rhythm patterns:", error);
          throw error;
        }
      },
      {
        detail: {
          tags: ["City Rhythm"],
          summary: "Get current city rhythm patterns",
        },
      }
    )
    .post(
      "/simulate/:hour",
      async ({ params: { hour } }) => {
        try {
          const hourNum = parseInt(hour, 10);
          if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
            throw new Error("Invalid hour. Must be between 0 and 23");
          }

          await store.services.cityRhythm.simulateDailyRoutines(hourNum);
          return {
            success: true,
            message: `Simulated city rhythm for hour ${hourNum}`,
          };
        } catch (error) {
          console.error(`Failed to simulate hour ${hour}:`, error);
          throw error;
        }
      },
      {
        params: t.Object({
          hour: t.String(),
        }),
        detail: {
          tags: ["City Rhythm"],
          summary: "Simulate city rhythm for a specific hour",
        },
      }
    )
    .post(
      "/patterns",
      async ({ body }) => {
        try {
          const pattern = {
            hour: body.hour,
            type: body.type,
            intensity: body.intensity,
            locations: body.locations,
          };

          await store.services.cityRhythm.addActivityPattern(pattern);
          return {
            success: true,
            data: pattern,
          };
        } catch (error) {
          console.error("Failed to add activity pattern:", error);
          throw error;
        }
      },
      {
        body: ActivityPattern,
        detail: {
          tags: ["City Rhythm"],
          summary: "Add a new activity pattern",
        },
      }
    )
    .get(
      "/forecast",
      async ({ query: { type } }) => {
        try {
          const forecast = await store.services.cityRhythm.getActivityForecast(
            type
          );
          return {
            success: true,
            data: forecast,
          };
        } catch (error) {
          console.error("Failed to get activity forecast:", error);
          throw error;
        }
      },
      {
        query: t.Object({
          type: t.Optional(ActivityType),
        }),
        detail: {
          tags: ["City Rhythm"],
          summary: "Get activity forecast",
          description:
            "Get forecast for specific activity type or all activities",
        },
      }
    );
