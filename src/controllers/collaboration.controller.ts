import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import { CityEvent, CityEventCategory } from "../types/city-events";
import {
  CulturalEvent,
  CulturalEventType,
  CulturalEventStatus,
} from "../types/culture.types";

export const CollaborationController = new Elysia({
  prefix: "/collaborate",
})
  .post(
    "/initiate",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        const event: CityEvent = {
          ...body,
          category: body.category as CityEventCategory,
          timestamp: Date.now(),
          status: "pending",
        };

        const sessionId =
          await appStore.services.collaborationService.initiateCollaboration(
            event
          );

        // Create a memory for significant collaborations
        if (event.severity >= 0.7 || event.urgency >= 0.7) {
          await appStore.services.cityMemory.storeCollectiveMemory({
            type: "social",
            description: `Significant collaboration initiated: ${event.title} - ${event.description}`,
            districtId: event.affectedDistricts[0], // Primary affected district
            timestamp: Date.now(),
            emotionalImpact: event.severity,
            participants: event.requiredAgents,
            culturalSignificance: event.impact.social,
            tags: ["collaboration", event.category, "significant-event"],
          });
        }

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
  .post(
    "/interaction",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        // Record the interaction
        const interaction =
          await appStore.services.collaborationService.recordAgentInteraction(
            body.agentId1,
            body.agentId2,
            body.content
          );

        // If the interaction is significant (based on content analysis)
        const significance =
          await appStore.services.vectorStore.analyzeSentiment(body.content);

        if (significance > 0.6) {
          // Create a memory for significant interactions
          await appStore.services.cityMemory.storeCollectiveMemory({
            type: "social",
            description: body.content,
            districtId: body.districtId,
            timestamp: Date.now(),
            emotionalImpact: significance,
            participants: [body.agentId1, body.agentId2],
            culturalSignificance: 0.7,
            tags: ["interaction", "agent-collaboration"],
          });
        }

        return {
          success: true,
          data: interaction,
          significance,
        };
      } catch (error) {
        console.error("Failed to record interaction:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        agentId1: t.String(),
        agentId2: t.String(),
        content: t.String(),
        districtId: t.String(),
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
  })
  .post(
    "/cultural-event",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      try {
        // Create a cultural event
        const culturalEvent: CulturalEvent = {
          id: crypto.randomUUID(),
          title: body.title,
          description: body.description,
          type: body.type,
          location: {
            districtId: body.districtId,
            venue: body.venue,
            coordinates: [body.coordinates[0], body.coordinates[1]],
          },
          startTime: body.startTime,
          endTime: body.endTime,
          participants: [],
          culturalSignificance: body.culturalSignificance,
          impact: {
            social: body.impact.social,
            cultural: body.impact.cultural,
            economic: body.impact.economic,
          },
          status: "upcoming",
          metrics: {
            attendance: 0,
            satisfaction: 0,
            culturalPreservation: 0,
            communityEngagement: 0,
          },
        };

        // Store the cultural event
        await appStore.services.culture.createEvent(culturalEvent);

        // Create a city memory for significant cultural events
        if (culturalEvent.culturalSignificance >= 0.7) {
          await appStore.services.cityMemory.storeCollectiveMemory({
            type: "cultural",
            description: `Cultural event initiated: ${culturalEvent.title} - ${culturalEvent.description}`,
            districtId: culturalEvent.location.districtId,
            timestamp: Date.now(),
            emotionalImpact: culturalEvent.impact.social,
            participants: culturalEvent.participants,
            culturalSignificance: culturalEvent.culturalSignificance,
            tags: ["cultural-event", culturalEvent.type],
            location: {
              coordinates: culturalEvent.location.coordinates,
              landmark: culturalEvent.location.venue,
            },
          });
        }

        // Initiate agent collaboration if needed
        if (
          culturalEvent.impact.social >= 0.6 ||
          culturalEvent.culturalSignificance >= 0.6
        ) {
          const collaborationEvent: CityEvent = {
            id: crypto.randomUUID(),
            title: `Cultural Collaboration: ${culturalEvent.title}`,
            description: `Collaborative effort for cultural event: ${culturalEvent.description}`,
            category: "cultural",
            severity: culturalEvent.culturalSignificance,
            duration:
              (new Date(culturalEvent.endTime).getTime() -
                new Date(culturalEvent.startTime).getTime()) /
              (1000 * 60 * 60), // hours
            urgency: 0.7,
            impact: {
              environmental: 0.3,
              social: culturalEvent.impact.social,
              economic: culturalEvent.impact.economic,
            },
            requiredAgents: [], // Will be filled by agent selection
            affectedDistricts: [culturalEvent.location.districtId],
            status: "pending",
            timestamp: Date.now(),
          };

          const sessionId =
            await appStore.services.collaborationService.initiateCollaboration(
              collaborationEvent
            );

          return {
            success: true,
            data: {
              culturalEvent,
              collaborationSessionId: sessionId,
            },
          };
        }

        return {
          success: true,
          data: culturalEvent,
        };
      } catch (error) {
        console.error("Failed to create cultural event:", error);
        throw error;
      }
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.String(),
        type: t.Union([
          t.Literal("art_exhibition"),
          t.Literal("street_performance"),
          t.Literal("food_festival"),
          t.Literal("heritage_tour"),
          t.Literal("workshop"),
          t.Literal("cultural_celebration"),
          t.Literal("religious_ceremony"),
          t.Literal("religious_festival"),
        ]),
        districtId: t.String(),
        venue: t.String(),
        coordinates: t.Array(t.Number(), { minItems: 2, maxItems: 2 }),
        startTime: t.String(),
        endTime: t.String(),
        culturalSignificance: t.Number(),
        impact: t.Object({
          social: t.Number(),
          cultural: t.Number(),
          economic: t.Number(),
        }),
      }),
    }
  );
