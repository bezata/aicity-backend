import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { DonationService } from "../services/donation.service";
import { AppStore } from "../types/store.types";
import { TextVectorQuery } from "../types/vector-store.types";

// Schema definitions
const DonationSchema = t.Object({
  donorId: t.String(),
  donorName: t.String(),
  departmentId: t.String(),
  districtId: t.String(),
  amount: t.Number(),
  purpose: t.String(),
  category: t.Union([
    t.Literal("general"),
    t.Literal("religious"),
    t.Literal("cultural"),
    t.Literal("educational"),
    t.Literal("infrastructure"),
    t.Literal("environmental"),
  ]),
  subcategory: t.Optional(
    t.Object({
      religious: t.Optional(
        t.Object({
          religion: t.String(),
          occasion: t.Optional(t.String()),
          ritual: t.Optional(t.String()),
          community: t.String(),
        })
      ),
      cultural: t.Optional(
        t.Object({
          tradition: t.String(),
          festival: t.Optional(t.String()),
          artForm: t.Optional(t.String()),
          community: t.String(),
        })
      ),
    })
  ),
  impact: t.Object({
    category: t.String(),
    description: t.String(),
    beneficiaries: t.Number(),
    culturalValue: t.Optional(t.Number()),
    communityEngagement: t.Optional(t.Number()),
    traditionPreservation: t.Optional(t.Number()),
  }),
  communityParticipation: t.Optional(
    t.Object({
      volunteers: t.Number(),
      events: t.Array(t.String()),
      activities: t.Array(t.String()),
    })
  ),
});

const ReactionSchema = t.Object({
  reaction: t.Union([
    t.Literal("gratitude"),
    t.Literal("excitement"),
    t.Literal("inspiration"),
  ]),
});

const DonationChallengeSchema = t.Object({
  title: t.String(),
  description: t.String(),
  category: t.Union([
    t.Literal("general"),
    t.Literal("religious"),
    t.Literal("cultural"),
    t.Literal("educational"),
    t.Literal("infrastructure"),
    t.Literal("environmental"),
  ]),
  targetAmount: t.Number(),
  startDate: t.Number(),
  endDate: t.Number(),
  rewards: t.Object({
    badge: t.String(),
    title: t.String(),
    perks: t.Array(t.String()),
  }),
  milestones: t.Array(
    t.Object({
      amount: t.Number(),
      reward: t.String(),
      achieved: t.Boolean(),
    })
  ),
  communityGoal: t.Object({
    description: t.String(),
    progress: t.Number(),
    target: t.Number(),
  }),
});

const CulturalMilestoneSchema = t.Object({
  title: t.String(),
  description: t.String(),
  category: t.Union([t.Literal("religious"), t.Literal("cultural")]),
  participants: t.Array(t.String()),
  impact: t.Object({
    culturalValue: t.Number(),
    communityEngagement: t.Number(),
    traditionPreservation: t.Number(),
  }),
  celebration: t.Object({
    event: t.String(),
    date: t.Number(),
    activities: t.Array(t.String()),
    specialGuests: t.Optional(t.Array(t.String())),
  }),
});

const SimpleDonationSchema = t.Object({
  userId: t.String(),
  userName: t.String(),
  amount: t.Number(),
  districtId: t.String(),
  departmentId: t.String(),
});

interface DonationMetadata {
  type: string;
  category: string;
  departmentId?: string;
  districtId?: string;
  donationId: string;
  donorName: string;
  amount: number;
  purpose: string;
  timestamp: number;
}

export const DonationController = (donationService: DonationService) =>
  new Elysia({ prefix: "/donations" })

    .post(
      "/",
      async ({ body }) => {
        const donationId = await donationService.processDonation(body);
        return { success: true, donationId };
      },
      {
        body: DonationSchema,
        detail: {
          tags: ["Donations"],
          summary: "Process a new donation",
        },
      }
    )
    .get(
      "/activities/:donationId",
      async ({ params: { donationId } }) => {
        const donation = Array.from(donationService["donations"].values()).find(
          (d) => d.id === donationId
        );
        if (!donation) {
          throw new Error("Donation not found");
        }
        return donationService.suggestCommunityActivities(donation);
      },
      {
        params: t.Object({
          donationId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get suggested community activities for a donation",
        },
      }
    )
    .get(
      "/events/:districtId",
      async ({ params: { districtId } }) => {
        return donationService.getUpcomingCulturalEvents(districtId);
      },
      {
        params: t.Object({
          districtId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get upcoming cultural and religious events in a district",
        },
      }
    )
    .get(
      "/district/:districtId/category/:category",
      async ({ params: { districtId, category } }) => {
        const donations = await donationService.getDonationsByDistrict(
          districtId
        );
        return donations.filter((d) => d.category === category);
      },
      {
        params: t.Object({
          districtId: t.String(),
          category: t.Union([
            t.Literal("religious"),
            t.Literal("cultural"),
            t.Literal("general"),
            t.Literal("educational"),
            t.Literal("infrastructure"),
            t.Literal("environmental"),
          ]),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get donations by category in a district",
        },
      }
    )
    .get(
      "/district/:districtId/cultural-impact",
      async ({ params: { districtId } }) => {
        const donations = await donationService.getDonationsByDistrict(
          districtId
        );
        const culturalDonations = donations.filter(
          (d) => d.category === "religious" || d.category === "cultural"
        );

        const summary = {
          totalDonations: culturalDonations.length,
          totalAmount: culturalDonations.reduce((sum, d) => sum + d.amount, 0),
          religions: new Set<string>(),
          traditions: new Set<string>(),
          festivals: new Set<string>(),
          artForms: new Set<string>(),
          upcomingEvents: await donationService.getUpcomingCulturalEvents(
            districtId
          ),
          communityEngagement: {
            totalVolunteers: 0,
            activeEvents: new Set<string>(),
            popularActivities: new Set<string>(),
          },
        };

        culturalDonations.forEach((d) => {
          if (d.subcategory?.religious) {
            summary.religions.add(d.subcategory.religious.religion);
            if (d.subcategory.religious.occasion)
              summary.festivals.add(d.subcategory.religious.occasion);
          }
          if (d.subcategory?.cultural) {
            summary.traditions.add(d.subcategory.cultural.tradition);
            if (d.subcategory.cultural.festival)
              summary.festivals.add(d.subcategory.cultural.festival);
            if (d.subcategory.cultural.artForm)
              summary.artForms.add(d.subcategory.cultural.artForm);
          }
          if (d.communityParticipation) {
            summary.communityEngagement.totalVolunteers +=
              d.communityParticipation.volunteers;
            d.communityParticipation.events.forEach((e) =>
              summary.communityEngagement.activeEvents.add(e)
            );
            d.communityParticipation.activities.forEach((a) =>
              summary.communityEngagement.popularActivities.add(a)
            );
          }
        });

        return {
          ...summary,
          religions: Array.from(summary.religions),
          traditions: Array.from(summary.traditions),
          festivals: Array.from(summary.festivals),
          artForms: Array.from(summary.artForms),
          communityEngagement: {
            ...summary.communityEngagement,
            activeEvents: Array.from(summary.communityEngagement.activeEvents),
            popularActivities: Array.from(
              summary.communityEngagement.popularActivities
            ),
          },
        };
      },
      {
        params: t.Object({
          districtId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get cultural and religious impact summary for a district",
        },
      }
    )
    .get(
      "/district/:districtId",
      async ({ params: { districtId } }) => {
        return donationService.getDonationsByDistrict(districtId);
      },
      {
        params: t.Object({
          districtId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get donations by district",
        },
      }
    )
    .get(
      "/department/:departmentId",
      async ({ params: { departmentId } }) => {
        return donationService.getDonationsByDepartment(departmentId);
      },
      {
        params: t.Object({
          departmentId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get donations by department",
        },
      }
    )
    .get(
      "/announcements/:districtId",
      async ({ params: { districtId } }) => {
        return donationService.getDistrictAnnouncements(districtId);
      },
      {
        params: t.Object({
          districtId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get district donation announcements",
        },
      }
    )
    .post(
      "/announcements/:announcementId/react",
      async ({ params: { announcementId }, body }) => {
        await donationService.addReactionToAnnouncement(
          announcementId,
          body.reaction
        );
        return { success: true };
      },
      {
        params: t.Object({
          announcementId: t.String(),
        }),
        body: ReactionSchema,
        detail: {
          tags: ["Donations"],
          summary: "Add reaction to donation announcement",
        },
      }
    )
    .get(
      "/:donationId/impact",
      async ({ params: { donationId } }) => {
        const impact = await donationService.getDonationImpact(donationId);
        if (!impact) {
          throw new Error("Impact not found for donation");
        }
        return impact;
      },
      {
        params: t.Object({
          donationId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get donation impact metrics",
        },
      }
    )
    .post(
      "/challenges",
      async ({ body }) => {
        const challengeId = await donationService.createDonationChallenge(body);
        return { success: true, challengeId };
      },
      {
        body: DonationChallengeSchema,
        detail: {
          tags: ["Donations"],
          summary: "Create a new donation challenge",
        },
      }
    )
    .get(
      "/challenges/active",
      async () => {
        return donationService.getActiveChallenges();
      },
      {
        detail: {
          tags: ["Donations"],
          summary: "Get all active donation challenges",
        },
      }
    )
    .get(
      "/challenges/:challengeId/progress",
      async ({ params: { challengeId } }) => {
        return donationService.getDonationChallengeProgress(challengeId);
      },
      {
        params: t.Object({
          challengeId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Get detailed progress of a donation challenge",
        },
      }
    )
    .post(
      "/challenges/:challengeId/participate",
      async ({ params: { challengeId }, body }) => {
        await donationService.participateInChallenge(
          body.donationId,
          challengeId
        );
        return { success: true };
      },
      {
        params: t.Object({
          challengeId: t.String(),
        }),
        body: t.Object({
          donationId: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Participate in a donation challenge",
        },
      }
    )
    .post(
      "/milestones",
      async ({ body }) => {
        const milestoneId = await donationService.createCulturalMilestone(body);
        return { success: true, milestoneId };
      },
      {
        body: CulturalMilestoneSchema,
        detail: {
          tags: ["Donations"],
          summary: "Create a new cultural milestone",
        },
      }
    )
    .post(
      "/stories/:donationId",
      async ({ params: { donationId }, body }) => {
        await donationService.addCommunityStory(donationId, body.story);
        return { success: true };
      },
      {
        params: t.Object({
          donationId: t.String(),
        }),
        body: t.Object({
          story: t.String(),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Add a community story to a donation",
        },
      }
    )
    .post(
      "/simple",
      async ({ body }) => {
        try {
          const donationData = {
            donorId: body.userId,
            donorName: body.userName,
            amount: body.amount,
            districtId: body.districtId,
            departmentId: body.departmentId,
            purpose: "Support city initiatives",
            category: "general" as const,
            impact: {
              category: "general",
              description: "Supporting city development",
              beneficiaries: Math.floor(body.amount / 100), // Estimate beneficiaries
            },
          };

          const donationId = await donationService.processDonation(
            donationData
          );

          return {
            success: true,
            donationId,
            message: "Donation processed and announced successfully",
          };
        } catch (error) {
          console.error("Failed to process simple donation:", error);
          throw error;
        }
      },
      {
        body: SimpleDonationSchema,
        detail: {
          tags: ["Donations"],
          summary: "Process a simple donation",
        },
      }
    )
    .post(
      "/search/semantic",
      async ({ body, store }) => {
        const appStore = store as AppStore;
        const query: TextVectorQuery<DonationMetadata> = {
          textQuery: body.query,
          filter: {
            type: { $eq: "donation" },
            ...(body.category && { category: { $eq: body.category } }),
            ...(body.departmentId && {
              departmentId: { $eq: body.departmentId },
            }),
            ...(body.districtId && { districtId: { $eq: body.districtId } }),
          },
          limit: body.limit || 10,
        };

        const results = await appStore.services.vectorStore.semanticSearch(
          query
        );

        return results.matches.map((match) => ({
          donationId: match.metadata.donationId,
          donorName: match.metadata.donorName,
          amount: match.metadata.amount,
          purpose: match.metadata.purpose,
          category: match.metadata.category,
          score: match.score,
          timestamp: match.metadata.timestamp,
        }));
      },
      {
        body: t.Object({
          query: t.String(),
          category: t.Optional(t.String()),
          departmentId: t.Optional(t.String()),
          districtId: t.Optional(t.String()),
          limit: t.Optional(t.Number()),
        }),
        detail: {
          tags: ["Donations"],
          summary: "Semantic search through donations",
        },
      }
    );
