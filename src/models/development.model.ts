import { Elysia, t } from "elysia";

export const DevelopmentModel = new Elysia().model({
  "development.project.create": t.Object({
    type: t.Union([
      t.Literal("residential"),
      t.Literal("commercial"),
      t.Literal("industrial"),
      t.Literal("infrastructure"),
      t.Literal("greenspace"),
    ]),
    location: t.Object({
      districtId: t.String(),
      coordinates: t.Array(t.Number(), { minItems: 2, maxItems: 2 }),
    }),
    scale: t.Number({ minimum: 0, maximum: 1 }),
    priority: t.Number({ minimum: 0, maximum: 1 }),
    sustainability: t.Optional(
      t.Object({
        energyEfficiency: t.Number(),
        greenScore: t.Number(),
        environmentalImpact: t.Number(),
      })
    ),
  }),

  "development.analysis": t.Object({
    populationTrends: t.Object({
      growth: t.Number(),
      density: t.Number(),
      distribution: t.Record(t.String(), t.Number()),
    }),
    infrastructureNeeds: t.Object({
      utilization: t.Number(),
      bottlenecks: t.Array(t.String()),
      expansionNeeds: t.Array(t.String()),
    }),
  }),
});
