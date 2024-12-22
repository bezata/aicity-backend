import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { AppStore } from "../services/app.services";
import { AgentProposal, DomainType } from "../types/city-coordinator.types";

// Schema definitions
const ProposalSchema = t.Object({
  title: t.String(),
  description: t.String(),
  category: t.Union([
    t.Literal("environmental"),
    t.Literal("social"),
    t.Literal("cultural"),
    t.Literal("infrastructure"),
  ]),
  domain: t.Union([
    t.Literal("urban_planning"),
    t.Literal("transportation"),
    t.Literal("energy"),
    t.Literal("water_waste"),
    t.Literal("healthcare"),
    t.Literal("education"),
    t.Literal("economy"),
    t.Literal("environmental"),
    t.Literal("social_cohesion"),
    t.Literal("law_enforcement"),
  ]),
  targetDistrict: t.String(),
  stakeholders: t.Array(t.String()),
  estimatedImpact: t.Object({
    overall: t.Number(),
    environmental: t.Optional(t.Number()),
    social: t.Optional(t.Number()),
    cultural: t.Optional(t.Number()),
    economic: t.Optional(t.Number()),
  }),
  location: t.Optional(
    t.Object({
      coordinates: t.Tuple([t.Number(), t.Number()]),
      landmark: t.Optional(t.String()),
    })
  ),
});

const CategorySchema = t.Union([
  t.Literal("environmental"),
  t.Literal("social"),
  t.Literal("cultural"),
]);

export const CityCoordinatorController = ({ store }: { store: AppStore }) =>
  new Elysia({ prefix: "/coordinator" })
    .use(swagger())
    .get(
      "/proposals",
      async () => {
        const proposals =
          await store.services.cityCoordinator.getActiveProposals();
        return { success: true, data: proposals };
      },
      {
        detail: {
          tags: ["City Coordinator"],
          summary: "Get all active proposals",
        },
      }
    )
    .post(
      "/proposals",
      async ({ body }) => {
        try {
          const proposal: AgentProposal = {
            ...body,
            id: crypto.randomUUID(),
            status: "proposed",
            timeline: {
              proposed: Date.now(),
            },
            resources: {
              required: [],
              allocated: [],
            },
            metrics: {
              success: 0,
              efficiency: 0,
              sustainability: 0,
            },
            impact: {
              metrics: {},
              priority: 0.5,
            },
            simulation: {
              confidence: 0.7,
              results: {},
            },
            requirements: {
              dependencies: [],
              approvals: [],
              resources: [],
            },
            location: body.location
              ? {
                  coordinates: [
                    body.location.coordinates[0],
                    body.location.coordinates[1],
                  ],
                  landmark: body.location.landmark,
                }
              : undefined,
          };

          const result = await store.services.cityCoordinator.submitProposal(
            proposal
          );
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("Failed to submit proposal:", error);
          throw error;
        }
      },
      {
        body: ProposalSchema,
        detail: {
          tags: ["City Coordinator"],
          summary: "Submit a new proposal",
        },
      }
    )
    .get(
      "/proposals/:id/history",
      async ({ params: { id } }) => {
        try {
          const memories = await store.services.cityMemory.searchMemories(
            `proposal ${id}`,
            {
              type: "environmental",
              minSignificance: 0.5,
            }
          );
          return {
            success: true,
            data: memories,
          };
        } catch (error) {
          console.error(`Failed to fetch proposal history for ${id}:`, error);
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ["City Coordinator"],
          summary: "Get proposal history",
          description:
            "Retrieve historical data and memories related to a specific proposal",
        },
      }
    )
    .get(
      "/insights",
      async ({ query: { category } }) => {
        try {
          const memories = await store.services.cityMemory.searchMemories(
            category || "all proposals",
            {
              type: category,
              minSignificance: 0.7,
            }
          );

          // Group memories by success/failure
          const insights = {
            successful: memories.filter((m) => m.emotionalImpact > 0.7),
            failed: memories.filter((m) => m.emotionalImpact <= 0.3),
            patterns: memories
              .map((m) => m.tags)
              .flat()
              .filter((t): t is string => !!t)
              .reduce((acc, tag) => {
                acc[tag] = (acc[tag] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
          };

          return {
            success: true,
            data: insights,
          };
        } catch (error) {
          console.error("Failed to fetch insights:", error);
          throw error;
        }
      },
      {
        query: t.Object({
          category: t.Optional(CategorySchema),
        }),
        detail: {
          tags: ["City Coordinator"],
          summary: "Get coordination insights",
          description:
            "Get insights and patterns from historical coordination data",
        },
      }
    );
