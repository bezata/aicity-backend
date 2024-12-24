import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";

export const DistrictMetricsController = new Elysia({
  prefix: "/districts/:districtId",
})
  // Weather metrics
  .get("/weather/current", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        temperature: metrics?.weather?.temperature || 22,
        feelsLike: metrics?.weather?.feelsLike || 23,
        humidity: metrics?.weather?.humidity || 65,
        precipitation: metrics?.weather?.precipitation || 0,
        windSpeed: metrics?.weather?.windSpeed || 12,
        windDirection: metrics?.weather?.windDirection || "NE",
        airQuality: metrics?.environmental?.airQuality || 85,
      };
    } catch (error) {
      console.error("Error fetching weather metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch weather metrics" }),
        { status: 500 }
      );
    }
  })

  // Emergency metrics
  .get("/emergency", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        level: metrics?.emergency?.level || "normal",
        activeIncidents: metrics?.emergency?.activeIncidents || 2,
        responseTeamsAvailable: metrics?.emergency?.responseTeamsAvailable || 8,
      };
    } catch (error) {
      console.error("Error fetching emergency metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch emergency metrics" }),
        { status: 500 }
      );
    }
  })

  // Vitals metrics
  .get("/vitals", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        populationCount: metrics?.vitals?.populationCount || 15234,
        activeEntities: metrics?.vitals?.activeEntities || 12453,
        visitorCount: metrics?.vitals?.visitorCount || 892,
        peakHoursStatus: metrics?.vitals?.peakHoursStatus || "Optimal",
      };
    } catch (error) {
      console.error("Error fetching vitals metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch vitals metrics" }),
        { status: 500 }
      );
    }
  })

  // Environmental metrics
  .get("/metrics/environmental", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        airQuality: metrics?.environmental?.airQuality || 92,
        noiseLevel: metrics?.environmental?.noiseLevel || 45,
        crowdingLevel: metrics?.environmental?.crowdingLevel || 68,
        greenSpaceUsage: metrics?.environmental?.greenSpaceUsage || 78,
      };
    } catch (error) {
      console.error("Error fetching environmental metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch environmental metrics" }),
        { status: 500 }
      );
    }
  })

  // Community activity metrics
  .get("/activity", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        activeEvents: metrics?.community?.activeEvents || 12,
        ongoingMeetings: metrics?.community?.ongoingMeetings || 5,
        collaborationSessions: metrics?.community?.collaborationSessions || 8,
        chatActivity: metrics?.community?.chatActivity || "High",
      };
    } catch (error) {
      console.error("Error fetching activity metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch activity metrics" }),
        { status: 500 }
      );
    }
  })

  // Safety metrics
  .get("/metrics/safety", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        overallScore: metrics?.safety?.overallScore || 95,
        recentIncidents: metrics?.safety?.recentIncidents || 3,
        responseTime: metrics?.safety?.responseTime || "2.5 min",
        serviceAvailability: metrics?.safety?.serviceAvailability || 98,
      };
    } catch (error) {
      console.error("Error fetching safety metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch safety metrics" }),
        { status: 500 }
      );
    }
  })

  // Resource metrics
  .get("/resources", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        energyConsumption: metrics?.resources?.energyConsumption || 72,
        waterUsage: metrics?.resources?.waterUsage || 65,
        wasteManagement: metrics?.resources?.wasteManagement || 88,
        efficiency: metrics?.resources?.efficiency || 91,
      };
    } catch (error) {
      console.error("Error fetching resource metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch resource metrics" }),
        { status: 500 }
      );
    }
  })

  // Transport metrics
  .get("/transport", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        trafficDensity: metrics?.transport?.trafficDensity || 45,
        publicTransportLoad: metrics?.transport?.publicTransportLoad || 68,
        parkingAvailable: metrics?.transport?.parkingAvailable || 342,
        avgTransitTime: metrics?.transport?.avgTransitTime || 15,
      };
    } catch (error) {
      console.error("Error fetching transport metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transport metrics" }),
        { status: 500 }
      );
    }
  })

  // Economic metrics
  .get("/metrics/economic", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        businessActivity: metrics?.economic?.businessActivity || 82,
        growthRate: metrics?.economic?.growthRate || 4.2,
        activeTransactions: metrics?.economic?.activeTransactions || 1243,
        marketSentiment: metrics?.economic?.marketSentiment || "Positive",
      };
    } catch (error) {
      console.error("Error fetching economic metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch economic metrics" }),
        { status: 500 }
      );
    }
  })

  // Cultural metrics
  .get("/metrics/cultural", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        eventAttendance: metrics?.cultural?.eventAttendance || 89,
        culturalSiteVisits: metrics?.cultural?.culturalSiteVisits || 1205,
        communityEngagement: metrics?.cultural?.communityEngagement || 86,
        socialCohesion: metrics?.cultural?.socialCohesion || 92,
      };
    } catch (error) {
      console.error("Error fetching cultural metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch cultural metrics" }),
        { status: 500 }
      );
    }
  })

  // Infrastructure metrics
  .get("/infrastructure", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        maintenanceRequests: metrics?.infrastructure?.maintenanceRequests || 23,
        serviceUptime: metrics?.infrastructure?.serviceUptime || 99.9,
        healthScore: metrics?.infrastructure?.healthScore || 94,
        developmentProgress: metrics?.infrastructure?.developmentProgress || 78,
      };
    } catch (error) {
      console.error("Error fetching infrastructure metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch infrastructure metrics" }),
        { status: 500 }
      );
    }
  })

  // Budget metrics
  .get("/budget", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        currentStatus: metrics?.budget?.currentStatus || 8500000,
        monthlySpending: metrics?.budget?.monthlySpending || 750000,
        efficiency: metrics?.budget?.efficiency || 92,
        allocation: metrics?.budget?.allocation || {
          infrastructure: 35,
          services: 25,
          development: 20,
          emergency: 20,
        },
      };
    } catch (error) {
      console.error("Error fetching budget metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch budget metrics" }),
        { status: 500 }
      );
    }
  })

  // Department metrics
  .get("/departments", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        responseTimes: metrics?.departments?.responseTimes || 95,
        serviceQuality: metrics?.departments?.serviceQuality || 89,
        resourceUtilization: metrics?.departments?.resourceUtilization || 86,
        efficiency: metrics?.departments?.efficiency || 91,
      };
    } catch (error) {
      console.error("Error fetching department metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch department metrics" }),
        { status: 500 }
      );
    }
  })

  // Donation metrics
  .get("/donations", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        activeCampaigns: metrics?.donations?.activeCampaigns || 5,
        totalDonations: metrics?.donations?.totalDonations || 2500000,
        goalProgress: metrics?.donations?.goalProgress || 75,
        impactScore: metrics?.donations?.impactScore || 89,
      };
    } catch (error) {
      console.error("Error fetching donation metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch donation metrics" }),
        { status: 500 }
      );
    }
  })

  // WebSocket connection for real-time updates
  .ws("/live", {
    body: t.Object({
      type: t.String(),
      data: t.Optional(t.Any()),
    }),
    open(ws) {
      try {
        const appStore = (this as any).store as AppStore;
        if (!appStore || !appStore.services) {
          console.error("Store or services not available");
          ws.close();
          return;
        }
        const districtId = ws.data.params.districtId;
        console.log(`WebSocket connection opened for district: ${districtId}`);

        // Use the DistrictWebSocketService to handle the connection
        appStore.services.districtWebSocket.handleConnection(
          ws as any,
          districtId
        );

        // Send initial heartbeat
        ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
      } catch (error) {
        console.error("Error in WebSocket connection:", error);
        ws.close();
      }
    },

    // Add message handler
    message(ws, message) {
      try {
        const data =
          typeof message === "string" ? JSON.parse(message) : message;
        if (data.type === "heartbeat") {
          // Respond to heartbeat
          ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    },

    // Add close handler
    close(ws) {
      const districtId = ws.data.params.districtId;
      console.log(`WebSocket connection closed for district: ${districtId}`);
    },
  })

  .get("/metrics", async ({ params: { districtId }, store }) => {
    const appStore = store as AppStore;
    try {
      const metrics = await appStore.services.metricsService.getCurrentMetrics(
        districtId
      );
      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      console.error("Error fetching metrics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch metrics" }),
        { status: 500 }
      );
    }
  });
