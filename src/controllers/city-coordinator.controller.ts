import { t } from "elysia";
import { AppStore } from "../services/app.services";
import { AgentProposal } from "../types/city-coordinator.types";

interface RequestWithStore {
  store: AppStore;
  params: {
    id: string;
  };
  query: {
    category?: "environmental" | "social" | "cultural";
  };
  body: Omit<
    AgentProposal,
    "id" | "status" | "timeline" | "resources" | "metrics"
  >;
}

export default (app: any) =>
  app.group("/coordinator", (app: any) =>
    app
      .get("/proposals", async ({ store }: RequestWithStore) => {
        const proposals =
          await store.services.cityCoordinator.getActiveProposals();
        return { success: true, data: proposals };
      })
      .post(
        "/proposals",
        async ({ body, store }: RequestWithStore) => {
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
          body: t.Object({
            title: t.String(),
            description: t.String(),
            category: t.Union([
              t.Literal("environmental"),
              t.Literal("social"),
              t.Literal("cultural"),
              t.Literal("infrastructure"),
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
                coordinates: t.Array(t.Number()),
                landmark: t.Optional(t.String()),
              })
            ),
          }),
        }
      )
      .get(
        "/proposals/:id/history",
        async ({ params: { id }, store }: RequestWithStore) => {
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
        }
      )
      .get(
        "/insights",
        async ({ query, store }: RequestWithStore) => {
          try {
            const memories = await store.services.cityMemory.searchMemories(
              query.category || "all proposals",
              {
                type: query.category,
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
            category: t.Optional(
              t.Union([
                t.Literal("environmental"),
                t.Literal("social"),
                t.Literal("cultural"),
              ])
            ),
          }),
        }
      )
  );
