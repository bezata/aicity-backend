import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { DonationService } from "../services/donation.service";

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

const CommunityStorySchema = t.Object({
  story: t.String(),
});

const SimpleDonationSchema = t.Object({
  userId: t.String(),
  userName: t.String(),
  amount: t.Number(),
  districtId: t.String(),
  departmentId: t.String(),
});

export function setupDonationRoutes(
  app: Elysia,
  donationService: DonationService
) {
  return app.use(swagger()).group("/donations", (app) =>
    app
      // Process new donation
      .post(
        "/",
        async ({ body }) => {
          const donationId = await donationService.processDonation(body);
          return { donationId };
        },
        {
          body: DonationSchema,
          detail: {
            summary: "Process a new donation",
            tags: ["Donations"],
          },
        }
      )

      // Get suggested activities for a donation
      .get(
        "/activities/:donationId",
        async ({ params: { donationId } }) => {
          const donation = Array.from(
            donationService["donations"].values()
          ).find((d) => d.id === donationId);
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
            summary: "Get suggested community activities for a donation",
            tags: ["Donations"],
          },
        }
      )

      // Get upcoming cultural events in a district
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
            summary: "Get upcoming cultural and religious events in a district",
            tags: ["Donations"],
          },
        }
      )

      // Get donations by category in a district
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
            summary: "Get donations by category in a district",
            tags: ["Donations"],
          },
        }
      )

      // Get cultural impact summary for a district
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
            totalAmount: culturalDonations.reduce(
              (sum, d) => sum + d.amount,
              0
            ),
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
              activeEvents: Array.from(
                summary.communityEngagement.activeEvents
              ),
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
            summary: "Get cultural and religious impact summary for a district",
            tags: ["Donations"],
          },
        }
      )

      // Get donations by district
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
            summary: "Get donations by district",
            tags: ["Donations"],
          },
        }
      )

      // Get donations by department
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
            summary: "Get donations by department",
            tags: ["Donations"],
          },
        }
      )

      // Get district announcements
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
            summary: "Get district donation announcements",
            tags: ["Donations"],
          },
        }
      )

      // Add reaction to announcement
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
            summary: "Add reaction to donation announcement",
            tags: ["Donations"],
          },
        }
      )

      // Get donation impact
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
            summary: "Get donation impact metrics",
            tags: ["Donations"],
          },
        }
      )

      // Create donation challenge
      .post(
        "/challenges",
        async ({ body }) => {
          const challengeId = await donationService.createDonationChallenge(
            body
          );
          return { challengeId };
        },
        {
          body: DonationChallengeSchema,
          detail: {
            summary: "Create a new donation challenge",
            tags: ["Donations"],
          },
        }
      )

      // Get active challenges
      .get(
        "/challenges/active",
        async () => {
          return donationService.getActiveChallenges();
        },
        {
          detail: {
            summary: "Get all active donation challenges",
            tags: ["Donations"],
          },
        }
      )

      // Get challenge progress
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
            summary: "Get detailed progress of a donation challenge",
            tags: ["Donations"],
          },
        }
      )

      // Participate in challenge
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
            summary: "Participate in a donation challenge",
            tags: ["Donations"],
          },
        }
      )

      // Create cultural milestone
      .post(
        "/milestones",
        async ({ body }) => {
          const milestoneId = await donationService.createCulturalMilestone(
            body
          );
          return { milestoneId };
        },
        {
          body: CulturalMilestoneSchema,
          detail: {
            summary: "Create a new cultural milestone",
            tags: ["Donations"],
          },
        }
      )

      // Add community story
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
          body: CommunityStorySchema,
          detail: {
            summary: "Add a community story to a donation",
            tags: ["Donations"],
          },
        }
      )

      // Get cultural impact summary
      .get(
        "/district/:districtId/cultural-impact",
        async ({ params: { districtId } }) => {
          return donationService
            .getDonationsByDistrict(districtId)
            .then((donations) => {
              const culturalDonations = donations.filter(
                (d) => d.category === "religious" || d.category === "cultural"
              );

              const summary = {
                totalDonations: culturalDonations.length,
                totalAmount: culturalDonations.reduce(
                  (sum, d) => sum + d.amount,
                  0
                ),
                activeEvents: new Set<string>(),
                traditions: new Set<string>(),
                communities: new Set<string>(),
                stories: [] as string[],
                upcomingCelebrations: [] as { event: string; date: number }[],
              };

              culturalDonations.forEach((d) => {
                if (d.communityParticipation?.events) {
                  d.communityParticipation.events.forEach((e) =>
                    summary.activeEvents.add(e)
                  );
                }
                if (d.culturalSignificance?.traditionLinks) {
                  d.culturalSignificance.traditionLinks.forEach((t) =>
                    summary.traditions.add(t)
                  );
                }
                if (d.subcategory?.religious?.community) {
                  summary.communities.add(d.subcategory.religious.community);
                }
                if (d.subcategory?.cultural?.community) {
                  summary.communities.add(d.subcategory.cultural.community);
                }
                if (d.culturalSignificance?.communityStories) {
                  summary.stories.push(
                    ...d.culturalSignificance.communityStories
                  );
                }
              });

              return {
                ...summary,
                activeEvents: Array.from(summary.activeEvents),
                traditions: Array.from(summary.traditions),
                communities: Array.from(summary.communities),
                stories: summary.stories.slice(0, 10), // Latest 10 stories
              };
            });
        },
        {
          params: t.Object({
            districtId: t.String(),
          }),
          detail: {
            summary: "Get cultural impact summary for a district",
            tags: ["Donations"],
          },
        }
      )

      // Get upcoming events
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
            summary: "Get upcoming cultural and religious events",
            tags: ["Donations"],
          },
        }
      )

      // Add this new route
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
        }
      )
  );
}
