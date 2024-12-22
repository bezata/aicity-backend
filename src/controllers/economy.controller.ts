import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import type {
  BusinessActivity,
  Investment,
  PropertyMarket,
  JobMarket,
} from "../types/economy.types";

export const EconomyController = new Elysia({ prefix: "/economy" })
  .get("/metrics/:districtId", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.economyService.getMarketMetrics(
        districtId
      );
      return { success: true, data: metrics };
    } catch (error) {
      console.error(
        `Failed to fetch market metrics for district ${districtId}:`,
        error
      );
      throw error;
    }
  })
  .get("/indicators", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const indicators =
        await appStore.services.economyService.getEconomicIndicators();
      return { success: true, data: indicators };
    } catch (error) {
      console.error("Failed to fetch economic indicators:", error);
      throw error;
    }
  })
  .post(
    "/businesses",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const business: BusinessActivity = {
          id: crypto.randomUUID(),
          type: body.type,
          districtId: body.districtId,
          revenue: body.revenue,
          employment: body.employment,
          growth: body.growth,
          stability: body.stability,
          culturalImpact: body.culturalImpact,
        };

        await appStore.services.economyService.addBusiness(business);
        return { success: true, data: business };
      } catch (error) {
        console.error("Failed to add business:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("retail"),
          t.Literal("service"),
          t.Literal("manufacturing"),
          t.Literal("technology"),
          t.Literal("cultural"),
        ]),
        districtId: t.String(),
        revenue: t.Number(),
        employment: t.Number(),
        growth: t.Number(),
        stability: t.Number(),
        culturalImpact: t.Number(),
      }),
    }
  )
  .post(
    "/property-markets",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const market: PropertyMarket = {
          districtId: body.districtId,
          residentialValue: body.residentialValue,
          commercialValue: body.commercialValue,
          developmentPotential: body.developmentPotential,
          culturalSignificance: body.culturalSignificance,
          marketTrend: body.marketTrend,
        };

        await appStore.services.economyService.updatePropertyMarket(market);
        return { success: true, data: market };
      } catch (error) {
        console.error("Failed to update property market:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        districtId: t.String(),
        residentialValue: t.Number(),
        commercialValue: t.Number(),
        developmentPotential: t.Number(),
        culturalSignificance: t.Number(),
        marketTrend: t.Union([
          t.Literal("rising"),
          t.Literal("stable"),
          t.Literal("declining"),
        ]),
      }),
    }
  )
  .post(
    "/job-markets",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const market: JobMarket = {
          districtId: body.districtId,
          openPositions: body.openPositions,
          skillsDemand: body.skillsDemand,
          averageSalary: body.averageSalary,
          employmentRate: body.employmentRate,
          jobCreationRate: body.jobCreationRate,
        };

        await appStore.services.economyService.updateJobMarket(market);
        return { success: true, data: market };
      } catch (error) {
        console.error("Failed to update job market:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        districtId: t.String(),
        openPositions: t.Number(),
        skillsDemand: t.Record(t.String(), t.Number()),
        averageSalary: t.Number(),
        employmentRate: t.Number(),
        jobCreationRate: t.Number(),
      }),
    }
  )
  .post(
    "/investments",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const investment: Investment = {
          id: crypto.randomUUID(),
          type: body.type,
          amount: body.amount,
          districtId: body.districtId,
          expectedReturn: body.expectedReturn,
          culturalValue: body.culturalValue,
          socialImpact: body.socialImpact,
        };

        await appStore.services.economyService.addInvestment(investment);
        return { success: true, data: investment };
      } catch (error) {
        console.error("Failed to add investment:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("infrastructure"),
          t.Literal("business"),
          t.Literal("cultural"),
          t.Literal("technology"),
        ]),
        amount: t.Number(),
        districtId: t.String(),
        expectedReturn: t.Number(),
        culturalValue: t.Number(),
        socialImpact: t.Number(),
      }),
    }
  )
  .get("/ai-metrics/:districtId", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics =
        await appStore.services.economyService.getAIEconomicMetrics(districtId);
      return { success: true, data: metrics };
    } catch (error) {
      console.error(
        `Failed to fetch AI metrics for district ${districtId}:`,
        error
      );
      throw error;
    }
  })
  .get(
    "/data-market/:districtId",
    async ({ params: { districtId }, store }) => {
      const appStore = store as AppStore;
      try {
        const dataMarket =
          await appStore.services.economyService.getDataMarketMetrics(
            districtId
          );
        return { success: true, data: dataMarket };
      } catch (error) {
        console.error(
          `Failed to fetch data market metrics for district ${districtId}:`,
          error
        );
        throw error;
      }
    }
  )
  .get("/innovation-metrics", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const metrics =
        await appStore.services.economyService.getInnovationMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      console.error("Failed to fetch innovation metrics:", error);
      throw error;
    }
  })
  .post(
    "/ai-businesses",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const business: BusinessActivity = {
          id: crypto.randomUUID(),
          type: body.type,
          districtId: body.districtId,
          revenue: body.revenue,
          employment: body.employment,
          growth: body.growth,
          stability: body.stability,
          culturalImpact: body.culturalImpact,
          aiIntegration: body.aiIntegration,
          dataUtilization: body.dataUtilization,
        };

        await appStore.services.economyService.addBusiness(business);
        return { success: true, data: business };
      } catch (error) {
        console.error("Failed to add AI business:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("ai_services"),
          t.Literal("data_processing"),
          t.Literal("technology"),
        ]),
        districtId: t.String(),
        revenue: t.Number(),
        employment: t.Number(),
        growth: t.Number(),
        stability: t.Number(),
        culturalImpact: t.Number(),
        aiIntegration: t.Number(),
        dataUtilization: t.Number(),
      }),
    }
  )
  .get("/digital-transformation", async ({ store }) => {
    const appStore = store as AppStore;
    try {
      const metrics =
        await appStore.services.economyService.getDigitalTransformationMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      console.error("Failed to fetch digital transformation metrics:", error);
      throw error;
    }
  });
