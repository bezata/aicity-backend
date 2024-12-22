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
          t.Literal("cultural"),
          t.Literal("religious"),
          t.Literal("heritage"),
          t.Literal("community"),
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
  .get("/growth-analysis", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const analysis =
        await appStore.services.developmentService.getGrowthAnalysis();
      return { success: true, data: analysis };
    } catch (error) {
      console.error("Failed to get growth analysis:", error);
      throw error;
    }
  })
  .post("/plan-growth", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      await appStore.services.developmentService.planCityGrowth();
      return { success: true, message: "City growth plan updated" };
    } catch (error) {
      console.error("Failed to plan city growth:", error);
      throw error;
    }
  })
  .get(
    "/infrastructure/:districtId",
    async ({ params, store }) => {
      const appStore = store as AppStore;
      try {
        const evaluation =
          await appStore.services.developmentService.evaluateInfrastructure(
            params.districtId
          );
        return { success: true, data: evaluation };
      } catch (error) {
        console.error("Failed to evaluate infrastructure:", error);
        throw error;
      }
    },
    {
      params: t.Object({
        districtId: t.String(),
      }),
    }
  );
