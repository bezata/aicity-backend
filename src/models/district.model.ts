import { Elysia, t } from "elysia";

export const DistrictModel = new Elysia().model({
  "district.create": t.Object({
    name: t.String(),
    type: t.Union([
      t.Literal("residential"),
      t.Literal("commercial"),
      t.Literal("cultural"),
      t.Literal("industrial"),
      t.Literal("mixed"),
    ]),
    population: t.Number(),
    coordinates: t.Array(t.Number(), { minItems: 2, maxItems: 2 }),
    culturalIndex: t.Number({ minimum: 0, maximum: 1 }),
    amenities: t.Array(t.String()),
    transportHubs: t.Array(t.String()),
  }),

  "district.metrics": t.Object({
    populationDensity: t.Number(),
    culturalActivity: t.Number(),
    economicHealth: t.Number(),
    safetyIndex: t.Number(),
    noiseLevel: t.Number(),
    transportAccess: t.Number(),
  }),
});
