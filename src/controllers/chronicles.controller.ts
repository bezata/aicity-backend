import { Elysia } from "elysia";
import type { AppStore } from "../services/app.services";

export class ChroniclesController {
  constructor(private readonly store: AppStore) {}

  routes(app: Elysia) {
    return app.group("/chronicles", (app) =>
      app
        .get("/daily", async () => {
          try {
            const chronicle =
              await this.store.services.chroniclesService.getDailyChronicle();
            return {
              success: true,
              data: chronicle,
            };
          } catch (error) {
            console.error("Failed to get daily chronicle:", error);
            throw error;
          }
        })
        .get("/news", async ({ query }) => {
          try {
            const limit = Number(query?.limit) || 5;
            const news =
              await this.store.services.chroniclesService.getLatestNews(limit);
            return {
              success: true,
              data: news,
            };
          } catch (error) {
            console.error("Failed to get latest news:", error);
            throw error;
          }
        })
        .get("/events", async ({ query }) => {
          try {
            const limit = Number(query?.limit) || 3;
            const events =
              await this.store.services.chroniclesService.getLatestEvents(
                limit
              );
            return {
              success: true,
              data: events,
            };
          } catch (error) {
            console.error("Failed to get latest events:", error);
            throw error;
          }
        })
        .get("/incidents", async ({ query }) => {
          try {
            const limit = Number(query?.limit) || 5;
            const incidents =
              await this.store.services.chroniclesService.getLatestIncidents(
                limit
              );
            return {
              success: true,
              data: incidents,
            };
          } catch (error) {
            console.error("Failed to get latest incidents:", error);
            throw error;
          }
        })
        .get("/incidents/active", async () => {
          try {
            const incidents =
              await this.store.services.chroniclesService.getLatestIncidents(
                100
              );
            return {
              success: true,
              data: incidents.filter((inc) => inc.status === "ongoing"),
            };
          } catch (error) {
            console.error("Failed to get active incidents:", error);
            throw error;
          }
        })
        .get("/budgets", async () => {
          try {
            const budgets =
              await this.store.services.chroniclesService.getDepartmentBudgets();
            return {
              success: true,
              data: budgets,
            };
          } catch (error) {
            console.error("Failed to get department budgets:", error);
            throw error;
          }
        })
        .get("/metrics", async () => {
          try {
            const metrics =
              await this.store.services.chroniclesService.getCityMetrics();
            return {
              success: true,
              data: metrics,
            };
          } catch (error) {
            console.error("Failed to get city metrics:", error);
            throw error;
          }
        })
        .get("/metrics/:category", async ({ params }) => {
          try {
            const metrics =
              await this.store.services.chroniclesService.getCityMetrics();
            const category = params.category as keyof typeof metrics;

            if (category in metrics) {
              return {
                success: true,
                data: metrics[category],
              };
            }

            throw new Error(`Invalid metrics category: ${category}`);
          } catch (error) {
            console.error("Failed to get category metrics:", error);
            throw error;
          }
        })
    );
  }
}
