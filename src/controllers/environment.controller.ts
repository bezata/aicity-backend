import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";

export const EnvironmentController = new Elysia({ prefix: "/environment" })
  .get("/metrics", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const metrics =
        await appStore.services.environmentService.getEnvironmentalMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
      throw error;
    }
  })
  .get("/alerts", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const alerts = Array.from(
        appStore.services.environmentService.getActiveAlerts()
      );
      return { success: true, data: alerts };
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
      throw error;
    }
  });
