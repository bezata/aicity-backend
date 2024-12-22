import { Elysia } from "elysia";
import { AdaptiveLearningService } from "../services/adaptive-learning.service";
import { AppStore } from "../services/app.services";
import {
  LearningData,
  AdaptationPlan,
  DomainInsight,
  LearningMetrics,
  LearningRecommendations,
} from "../types/learning.types";

export class AdaptiveLearningController {
  private adaptiveLearningService: AdaptiveLearningService;

  constructor(private store: AppStore) {
    this.adaptiveLearningService = store.services.adaptiveLearning;
  }

  setup(app: Elysia) {
    return app.group("/adaptive-learning", (app) =>
      app
        .get("/data", async (): Promise<LearningData> => {
          return this.adaptiveLearningService.getCityLearningData();
        })

        .get("/plans", async (): Promise<AdaptationPlan[]> => {
          return this.adaptiveLearningService.getAdaptationPlans();
        })

        .post("/plans", async ({ body }): Promise<AdaptationPlan> => {
          return this.adaptiveLearningService.createAdaptationPlan(
            body as AdaptationPlan
          );
        })

        .get(
          "/insights/:domain",
          async ({ params: { domain } }): Promise<DomainInsight> => {
            return this.adaptiveLearningService.getDomainInsights(domain);
          }
        )

        .post("/events/process", async ({ body }) => {
          await this.adaptiveLearningService.handleEvent(body);
          return { success: true };
        })

        .get("/metrics/learning", async (): Promise<LearningMetrics> => {
          return this.adaptiveLearningService.getLearningMetrics();
        })

        .get("/recommendations", async (): Promise<LearningRecommendations> => {
          return this.adaptiveLearningService.getRecommendations();
        })
    );
  }
}
