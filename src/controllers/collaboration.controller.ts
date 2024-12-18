import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import { CityEvent, CityEventCategory } from "../types/city-events";

export const CollaborationController = new Elysia({
  prefix: "/collaborate",
  websocket: {
    idleTimeout: 30000,
  },
})
  .post(
    "/initiate",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const event: CityEvent = {
          ...body,
          type: body.category as CityEventCategory,
          category: body.category as CityEventCategory,
          timestamp: Date.now(),
          status: "pending",
        };

        const sessionId =
          await appStore.services.collaborationService.initiateCollaboration(
            event
          );
        return {
          success: true,
          sessionId,
          message: "Collaboration session initiated",
        };
      } catch (error) {
        console.error("Failed to initiate collaboration:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        id: t.String(),
        title: t.String(),
        description: t.String(),
        category: t.String(),
        severity: t.Number(),
        duration: t.Number(),
        urgency: t.Number(),
        impact: t.Object({
          environmental: t.Number(),
          social: t.Number(),
          economic: t.Number(),
        }),
        requiredAgents: t.Array(t.String()),
        affectedDistricts: t.Array(t.String()),
      }),
    }
  )
  .ws("/session/:sessionId", {
    body: t.Object({
      type: t.String(),
      content: t.String(),
    }),
    message(ws, message) {
      const store = ws.data.store as AppStore;
      const sessionId = ws.data.params.sessionId;
      store.services.socketManager.handleConnection(ws, sessionId);
      console.log("Received message:", message);
    },
  });
