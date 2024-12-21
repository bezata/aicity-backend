import { Elysia, t } from "elysia";

export const DonationModel = new Elysia().model({
  "donation.create": t.Object({
    userId: t.String(),
    amount: t.Number(),
    projectId: t.Optional(t.String()),
    districtId: t.Optional(t.String()),
    purpose: t.String(),
    anonymous: t.Optional(t.Boolean()),
    recurring: t.Optional(t.Boolean()),
  }),

  "donation.metrics": t.Object({
    totalAmount: t.Number(),
    donorCount: t.Number(),
    projectDistribution: t.Record(t.String(), t.Number()),
    impactMetrics: t.Object({
      projectsSupported: t.Number(),
      beneficiariesReached: t.Number(),
      communityImpact: t.Number(),
    }),
  }),
});
