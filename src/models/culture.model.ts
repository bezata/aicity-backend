import { Elysia, t } from "elysia";

export const CultureModel = new Elysia().model({
  "culture.event": t.Object({
    name: t.String(),
    type: t.Union([
      t.Literal("festival"),
      t.Literal("exhibition"),
      t.Literal("performance"),
      t.Literal("workshop"),
      t.Literal("community_gathering"),
    ]),
    districtId: t.String(),
    duration: t.Number(),
    expectedAttendance: t.Number(),
    culturalTags: t.Array(t.String()),
    impactMetrics: t.Object({
      communityEngagement: t.Number(),
      culturalPreservation: t.Number(),
      economicBenefit: t.Number(),
    }),
  }),

  "culture.district": t.Object({
    landmarks: t.Array(t.String()),
    traditions: t.Array(t.String()),
    communitySpaces: t.Array(t.String()),
    culturalScore: t.Number({ minimum: 0, maximum: 1 }),
    diversityIndex: t.Number({ minimum: 0, maximum: 1 }),
  }),
});
