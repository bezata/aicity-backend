import { t } from "elysia";
import { AppStore } from "../services/app.services";
import {
  CulturalProject,
  DonationCampaign,
  CulturalDonation,
} from "../types/cultural-donation.types";

interface RequestWithStore {
  store: AppStore;
  params: {
    projectId?: string;
    campaignId?: string;
  };
  query: {
    type?: string;
    status?: string;
    district?: string;
  };
  body: any;
}

export default (app: any) =>
  app.group("/cultural-donations", (app: any) =>
    app
      .get("/projects", async ({ store, query }: RequestWithStore) => {
        try {
          const projects = await store.services.culturalDonation.getProjects({
            type: query.type,
            status: query.status,
            district: query.district,
          });

          return {
            success: true,
            data: projects,
          };
        } catch (error) {
          console.error("Failed to get cultural projects:", error);
          throw error;
        }
      })
      .post(
        "/projects",
        async ({ store, body }: RequestWithStore) => {
          try {
            const project =
              await store.services.culturalDonation.createDonationProject(body);
            return {
              success: true,
              data: project,
            };
          } catch (error) {
            console.error("Failed to create cultural project:", error);
            throw error;
          }
        },
        {
          body: t.Object({
            type: t.Union([
              t.Literal("heritage"),
              t.Literal("venue"),
              t.Literal("public_art"),
              t.Literal("community_space"),
              t.Literal("religious_building"),
              t.Literal("interfaith_center"),
            ]),
            title: t.String(),
            description: t.String(),
            districtId: t.String(),
            location: t.Array(t.Number()),
            targetAmount: t.Number(),
            expectedImpact: t.Object({
              culturalPreservation: t.Number(),
              communityEngagement: t.Number(),
              touristAttraction: t.Number(),
              spiritualSignificance: t.Optional(t.Number()),
              interfaithHarmony: t.Optional(t.Number()),
            }),
            religiousAffiliation: t.Optional(
              t.Object({
                tradition: t.String(),
                leaderApproval: t.Optional(t.String()),
                communitySupport: t.Number(),
              })
            ),
          }),
        }
      )
      .get(
        "/projects/:projectId",
        async ({ params: { projectId }, store }: RequestWithStore) => {
          try {
            const project = await store.services.culturalDonation.getProject(
              projectId!
            );
            if (!project) {
              throw new Error("Project not found");
            }
            return {
              success: true,
              data: project,
            };
          } catch (error) {
            console.error(`Failed to get project ${projectId}:`, error);
            throw error;
          }
        }
      )
      .get(
        "/projects/:projectId/campaigns",
        async ({ params: { projectId }, store }: RequestWithStore) => {
          try {
            const campaigns =
              await store.services.culturalDonation.getCampaigns(projectId!);
            return {
              success: true,
              data: campaigns,
            };
          } catch (error) {
            console.error(
              `Failed to get campaigns for project ${projectId}:`,
              error
            );
            throw error;
          }
        }
      )
      .post(
        "/projects/:projectId/campaigns",
        async ({ params: { projectId }, store, body }: RequestWithStore) => {
          try {
            const campaign =
              await store.services.culturalDonation.createDonationCampaign(
                projectId!,
                body
              );
            return {
              success: true,
              data: campaign,
            };
          } catch (error) {
            console.error("Failed to create donation campaign:", error);
            throw error;
          }
        },
        {
          body: t.Object({
            title: t.String(),
            description: t.String(),
            startDate: t.Number(),
            endDate: t.Number(),
            targetAmount: t.Number(),
            specialEvents: t.Array(
              t.Object({
                name: t.String(),
                date: t.Number(),
                type: t.Union([
                  t.Literal("fundraiser"),
                  t.Literal("ceremony"),
                  t.Literal("community_gathering"),
                ]),
              })
            ),
            rewards: t.Array(
              t.Object({
                level: t.Number(),
                description: t.String(),
                recognition: t.String(),
              })
            ),
          }),
        }
      )
      .post(
        "/projects/:projectId/donate",
        async ({ params: { projectId }, store, body }: RequestWithStore) => {
          try {
            await store.services.culturalDonation.processDonation({
              projectId: projectId!,
              ...body,
            });
            return {
              success: true,
              message: "Donation processed successfully",
            };
          } catch (error) {
            console.error("Failed to process donation:", error);
            throw error;
          }
        },
        {
          body: t.Object({
            donorId: t.String(),
            amount: t.Number(),
            message: t.Optional(t.String()),
            anonymous: t.Optional(t.Boolean()),
            recurringInterval: t.Optional(
              t.Union([
                t.Literal("monthly"),
                t.Literal("quarterly"),
                t.Literal("yearly"),
              ])
            ),
            earmarkForPhase: t.Optional(t.String()),
          }),
        }
      )
  );
