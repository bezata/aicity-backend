import { Elysia, t } from "elysia";
import { websocket } from "@elysiajs/websocket";
import type { AppStore } from "../services/app.services";
import { CityEvent, CityEventCategory } from "../types/city-events";

export const CollaborationController = new Elysia({ prefix: "/collaborate" })
  .use(websocket())
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
    open(ws) {
      const sessionId = ws.data.params.sessionId;
      const store = ws.data.store as AppStore;
      store.services.socketManager.handleConnection(ws as any, sessionId);
    },
    message(ws, message) {
      console.log("Received message:", message);
    },
  });
