import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import { CityEvent } from "../types/city-events";

export const AgentCollaborationController = new Elysia({
  prefix: "/collaborations",
})
  .get("/", async ({ store }) => {
    const appStore = store as AppStore;
    const sessions =
      await appStore.services.collaborationService.getAllSessions();
    return { success: true, data: sessions };
  })
  .get("/:id", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    const session =
      await appStore.services.collaborationService.getSessionStatus(id);
    return { success: true, data: session };
  })
  .post(
    "/department/:departmentId",
    async ({ params: { departmentId }, body, store }) => {
      const appStore = store as AppStore;

      // Check department budget first
      const department =
        await appStore.services.departmentService.getDepartment(departmentId);
      if (!department) throw new Error("Department not found");

      const availableBudget = department.budget.total - department.budget.spent;
      if (availableBudget < body.requiredBudget) {
        return {
          success: false,
          error: "Insufficient department budget",
          required: body.requiredBudget,
          available: availableBudget,
        };
      }

      // Create city event for collaboration
      const event: CityEvent = {
        id: crypto.randomUUID(),
        title: body.topic,
        description: body.description,
        category: "cultural",
        severity: body.priority / 10, // Convert priority (1-10) to severity (0-1)
        urgency: body.priority / 10,
        duration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        requiredAgents: body.participants,
        affectedDistricts: [departmentId],
        impact: {
          environmental: body.expectedImpact.environmental,
          social: body.expectedImpact.social,
          economic: body.expectedImpact.economic,
          cultural: body.expectedImpact.cultural,
        },
        status: "pending",
        timestamp: Date.now(),
      };

      // Start collaboration if budget is sufficient
      const sessionId =
        await appStore.services.collaborationService.initiateCollaboration(
          event
        );

      return {
        success: true,
        data: {
          sessionId,
          event,
        },
      };
    },
    {
      body: t.Object({
        topic: t.String(),
        description: t.String(),
        requiredBudget: t.Number(),
        priority: t.Number(),
        expectedImpact: t.Object({
          environmental: t.Number(),
          social: t.Number(),
          economic: t.Number(),
          cultural: t.Optional(t.Number()),
        }),
        participants: t.Array(t.String()),
      }),
    }
  )
  .ws("/subscribe", {
    open(ws) {
      const appStore = ws.data.store as AppStore;
      const collaborationService = appStore.services.collaborationService;

      // Subscribe to collaboration events
      collaborationService.on("collaborationStarted", (data) => {
        ws.send(
          JSON.stringify({
            type: "collaboration_started",
            timestamp: Date.now(),
            data,
          })
        );
      });

      collaborationService.on("decisionMade", (data) => {
        ws.send(
          JSON.stringify({
            type: "decision_made",
            timestamp: Date.now(),
            data,
          })
        );
      });

      collaborationService.on("agentInteraction", (data) => {
        ws.send(
          JSON.stringify({
            type: "agent_interaction",
            timestamp: Date.now(),
            data,
          })
        );
      });

      collaborationService.on("collaborationCompleted", (data) => {
        ws.send(
          JSON.stringify({
            type: "collaboration_completed",
            timestamp: Date.now(),
            data,
          })
        );
      });

      collaborationService.on("collaborationFailed", (data) => {
        ws.send(
          JSON.stringify({
            type: "collaboration_failed",
            timestamp: Date.now(),
            data,
          })
        );
      });
    },
    message(ws, message) {
      // Handle incoming messages if needed
      try {
        const data = JSON.parse(String(message));
        console.log("📩 Received collaboration message:", data);
      } catch (error) {
        console.error("Error handling collaboration message:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            timestamp: Date.now(),
            error: "Failed to process message",
          })
        );
      }
    },
  });
