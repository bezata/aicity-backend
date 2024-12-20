import { Elysia, t } from "elysia";

export const EnvironmentModel = new Elysia().model({
  "environment.alert": t.Object({
    type: t.Union([
      t.Literal("air"),
      t.Literal("water"),
      t.Literal("noise"),
      t.Literal("waste"),
    ]),
    severity: t.Number({ minimum: 0, maximum: 1 }),
    location: t.Object({
      districtId: t.String(),
      coordinates: t.Array(t.Number(), { minItems: 2, maxItems: 2 }),
    }),
    metrics: t.Object({
      airQuality: t.Optional(t.Number()),
      waterQuality: t.Optional(t.Number()),
      noiseLevel: t.Optional(t.Number()),
      wasteLevel: t.Optional(t.Number()),
    }),
  }),

  "environment.metrics": t.Object({
    airQuality: t.Number(),
    greenCoverage: t.Number(),
    sustainability: t.Number(),
    emissions: t.Number(),
    waterQuality: t.Number(),
    noiseLevel: t.Number(),
  }),
});
