import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { DataManagementService } from "../services/data-management.service";

// Request body types for validation
const StreamProcessingSchema = t.Object({
  streamId: t.String(),
  data: t.Any(),
});

const PrivacySettingsSchema = t.Object({
  dataType: t.String(),
  settings: t.Object({
    encryptionLevel: t.Union([
      t.Literal("standard"),
      t.Literal("high"),
      t.Literal("military"),
    ]),
    retentionPeriod: t.Number(),
    accessControl: t.Object({
      publicAccess: t.Boolean(),
      authorizedRoles: t.Array(t.String()),
      ipWhitelist: t.Array(t.String()),
    }),
    anonymizationRules: t.Object({
      personalData: t.Boolean(),
      locationData: t.Boolean(),
      sensitiveInfo: t.Boolean(),
    }),
  }),
});

const MarketListingSchema = t.Object({
  dataType: t.String(),
  description: t.String(),
  price: t.Number(),
  quality: t.Number(),
  provider: t.String(),
  privacyLevel: t.String(),
  accessRights: t.Array(t.String()),
  validUntil: t.Number(),
  timestamp: t.Number({ default: Date.now }),
});

const DataPurchaseSchema = t.Object({
  listingId: t.String(),
  buyerId: t.String(),
});

export function setupDataManagementRoutes(
  app: Elysia,
  dataService: DataManagementService
) {
  return app.use(swagger()).group("/data", (app) =>
    app
      // Real-time Data Processing
      .post(
        "/process",
        async ({ body }) => {
          const result = await dataService.processDataStream(
            body.streamId,
            body.data
          );
          return result;
        },
        {
          body: StreamProcessingSchema,
          detail: {
            summary: "Process a data stream",
            tags: ["Data Management"],
          },
        }
      )

      // Privacy Settings Management
      .post(
        "/privacy",
        async ({ body }) => {
          await dataService.setPrivacySettings(body.dataType, body.settings);
          return { success: true };
        },
        {
          body: PrivacySettingsSchema,
          detail: {
            summary: "Set privacy settings for a data type",
            tags: ["Data Management"],
          },
        }
      )

      .get(
        "/privacy/:dataType",
        async ({ params: { dataType } }) => {
          return dataService.getPrivacySettings().get(dataType);
        },
        {
          params: t.Object({
            dataType: t.String(),
          }),
          detail: {
            summary: "Get privacy settings for a data type",
            tags: ["Data Management"],
          },
        }
      )

      // Data Market Operations
      .post(
        "/market/listing",
        async ({ body }) => {
          const id = await dataService.createMarketListing(body);
          return { id };
        },
        {
          body: MarketListingSchema,
          detail: {
            summary: "Create a new market listing",
            tags: ["Data Management"],
          },
        }
      )

      .get(
        "/market/listings",
        async ({ query }) => {
          const listings = Array.from(dataService.getMarketListings().values());
          if (query?.type) {
            return listings.filter((l) => l.dataType === query.type);
          }
          return listings;
        },
        {
          query: t.Object({
            type: t.Optional(t.String()),
          }),
          detail: {
            summary: "Get all market listings",
            tags: ["Data Management"],
          },
        }
      )

      .get(
        "/market/listing/:id",
        async ({ params: { id } }) => {
          return dataService.getMarketListings().get(id);
        },
        {
          params: t.Object({
            id: t.String(),
          }),
          detail: {
            summary: "Get a specific market listing",
            tags: ["Data Management"],
          },
        }
      )

      .post(
        "/market/purchase",
        async ({ body }) => {
          const data = await dataService.purchaseData(
            body.listingId,
            body.buyerId
          );
          return data;
        },
        {
          body: DataPurchaseSchema,
          detail: {
            summary: "Purchase data from a market listing",
            tags: ["Data Management"],
          },
        }
      )

      // Processing Metrics
      .get(
        "/metrics",
        async ({ query }) => {
          const metrics = Array.from(
            dataService.getProcessingMetrics().entries()
          ).map(([streamId, metrics]) => ({ streamId, ...metrics }));

          if (query?.streamId) {
            return metrics.filter((m) => m.streamId === query.streamId);
          }
          return metrics;
        },
        {
          query: t.Object({
            streamId: t.Optional(t.String()),
          }),
          detail: {
            summary: "Get processing metrics",
            tags: ["Data Management"],
          },
        }
      )

      .get(
        "/metrics/:streamId",
        async ({ params: { streamId } }) => {
          const metrics = dataService.getProcessingMetrics().get(streamId);
          if (!metrics) {
            throw new Error("Metrics not found for stream");
          }
          return metrics;
        },
        {
          params: t.Object({
            streamId: t.String(),
          }),
          detail: {
            summary: "Get metrics for a specific stream",
            tags: ["Data Management"],
          },
        }
      )
  );
}
