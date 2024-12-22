import { t } from "elysia";
import { AppStore } from "../services/app.services";

interface RequestWithStore {
  store: AppStore;
  params: {
    hour?: string;
  };
  query: {
    type?: "transport" | "business" | "leisure" | "social";
    intensity?: string;
  };
  body: {
    hour: number;
    type: "transport" | "business" | "leisure" | "social";
    intensity: number;
    locations: string[];
  };
}

export default (app: any) =>
  app.group("/rhythm", (app: any) =>
    app
      .get("/current", async ({ store }: RequestWithStore) => {
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
      })
      .post(
        "/simulate/:hour",
        async ({ params: { hour }, store }: RequestWithStore) => {
          try {
            const hourNum = parseInt(hour || "0", 10);
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
        }
      )
      .post(
        "/patterns",
        async ({ body, store }: RequestWithStore) => {
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
          body: t.Object({
            hour: t.Number({ minimum: 0, maximum: 23 }),
            type: t.Union([
              t.Literal("transport"),
              t.Literal("business"),
              t.Literal("leisure"),
              t.Literal("social"),
            ]),
            intensity: t.Number({ minimum: 0, maximum: 1 }),
            locations: t.Array(t.String()),
          }),
        }
      )
      .get(
        "/forecast",
        async ({ query: { type }, store }: RequestWithStore) => {
          try {
            const forecast =
              await store.services.cityRhythm.getActivityForecast(type);
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
            type: t.Optional(
              t.Union([
                t.Literal("transport"),
                t.Literal("business"),
                t.Literal("leisure"),
                t.Literal("social"),
              ])
            ),
          }),
        }
      )
  );