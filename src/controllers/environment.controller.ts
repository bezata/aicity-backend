import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import type {
  EnvironmentalAlert,
  SustainabilityProject,
  GreenInitiative,
  EnvironmentalZone,
  SmartSensor,
} from "../types/environment.types";

export const EnvironmentController = new Elysia({ prefix: "/environment" })
  .get("/metrics/:districtId", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics =
        await appStore.services.environmentService.getEnvironmentalMetrics(
          districtId
        );
      return { success: true, data: metrics };
    } catch (error) {
      console.error(
        `Failed to fetch environmental metrics for district ${districtId}:`,
        error
      );
      throw error;
    }
  })
  .get("/alerts", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const alerts = appStore.services.environmentService.getActiveAlerts();
      return { success: true, data: Array.from(alerts) };
    } catch (error) {
      console.error("Failed to fetch environmental alerts:", error);
      throw error;
    }
  })
  .post("/alerts/:alertId/resolve", async ({ params: { alertId }, store }) => {
    const appStore = store as AppStore;
    try {
      await appStore.services.environmentService.resolveAlert(alertId);
      return { success: true };
    } catch (error) {
      console.error(`Failed to resolve alert ${alertId}:`, error);
      throw error;
    }
  })
  .post(
    "/projects",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const project: SustainabilityProject = {
          id: crypto.randomUUID(),
          type: body.type,
          districtId: body.districtId,
          status: "planned",
          timeline: {
            start: body.timeline.start,
            end: body.timeline.end,
          },
          metrics: {
            progress: 0,
            impact: {
              environmental: 0,
              social: 0,
              economic: 0,
            },
          },
        };

        await appStore.services.environmentService.addSustainabilityProject(
          project
        );
        return { success: true, data: project };
      } catch (error) {
        console.error("Failed to create sustainability project:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("green_space"),
          t.Literal("emissions_reduction"),
          t.Literal("water_conservation"),
          t.Literal("waste_management"),
        ]),
        districtId: t.String(),
        timeline: t.Object({
          start: t.Number(),
          end: t.Number(),
        }),
      }),
    }
  )
  .post(
    "/initiatives",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const initiative: GreenInitiative = {
          id: crypto.randomUUID(),
          name: body.name,
          description: body.description,
          districtId: body.districtId,
          type: body.type,
          status: "proposed",
          participants: [],
          metrics: {
            participation: 0,
            environmentalImpact: 0,
            communityEngagement: 0,
          },
        };

        await appStore.services.environmentService.addGreenInitiative(
          initiative
        );
        return { success: true, data: initiative };
      } catch (error) {
        console.error("Failed to create green initiative:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.String(),
        districtId: t.String(),
        type: t.Union([
          t.Literal("tree_planting"),
          t.Literal("urban_farming"),
          t.Literal("renewable_energy"),
          t.Literal("recycling"),
        ]),
      }),
    }
  )
  .post(
    "/zones",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const zone: EnvironmentalZone = {
          id: crypto.randomUUID(),
          type: body.type,
          districtId: body.districtId,
          boundaries: body.boundaries,
          restrictions: {
            maxEmissions: body.restrictions.maxEmissions,
            noiseLimit: body.restrictions.noiseLimit,
            greenSpaceRatio: body.restrictions.greenSpaceRatio,
          },
          status: "proposed",
        };

        await appStore.services.environmentService.addEnvironmentalZone(zone);
        return { success: true, data: zone };
      } catch (error) {
        console.error("Failed to create environmental zone:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("protection"),
          t.Literal("conservation"),
          t.Literal("development"),
        ]),
        districtId: t.String(),
        boundaries: t.Array(t.Array(t.Number())),
        restrictions: t.Object({
          maxEmissions: t.Number(),
          noiseLimit: t.Number(),
          greenSpaceRatio: t.Number(),
        }),
      }),
    }
  )
  .post(
    "/sensors",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const sensor: SmartSensor = {
          id: crypto.randomUUID(),
          type: body.type,
          location: {
            districtId: body.districtId,
            coordinates: body.coordinates,
          },
          value: 0,
          lastUpdate: Date.now(),
          status: "active",
        };

        await appStore.services.environmentService.addSmartSensor(sensor);
        return { success: true, data: sensor };
      } catch (error) {
        console.error("Failed to add smart sensor:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("air_quality"),
          t.Literal("water_quality"),
          t.Literal("noise"),
          t.Literal("emissions"),
        ]),
        districtId: t.String(),
        coordinates: t.Array(t.Number()),
      }),
    }
  );
