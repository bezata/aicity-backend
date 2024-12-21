import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import type { DevelopmentProject } from "../types/development.types";

export const DevelopmentController = new Elysia({ prefix: "/development" })
  .get("/projects", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const projects = Array.from(
        appStore.services.developmentService.getProjects().values()
      );
      return { success: true, data: projects };
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      throw error;
    }
  })
  .post(
    "/projects",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const project =
          await appStore.services.developmentService.submitProject({
            ...body,
            location: {
              ...body.location,
              coordinates: body.location.coordinates as [number, number],
            },
          });
        return { success: true, data: project };
      } catch (error) {
        console.error("Failed to create project:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("residential"),
          t.Literal("commercial"),
          t.Literal("industrial"),
          t.Literal("infrastructure"),
          t.Literal("greenspace"),
        ]),
        location: t.Object({
          districtId: t.String(),
          coordinates: t.Array(t.Number(), { minItems: 2, maxItems: 2 }),
        }),
        scale: t.Number(),
        priority: t.Number(),
      }),
    }
  )
  .get("/analysis", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const analysis =
        await appStore.services.developmentService.getGrowthAnalysis();
      return { success: true, data: analysis };
    } catch (error) {
      console.error("Failed to get analysis:", error);
      throw error;
    }
  });
