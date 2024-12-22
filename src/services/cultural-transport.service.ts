import { EventEmitter } from "events";
import { CultureService } from "./culture.service";
import { TransportService } from "./transport.service";
import { VectorStoreService } from "./vector-store.service";
import { AnalyticsService } from "./analytics.service";
import { TransportRoute } from "../types/transport.types";

interface CulturalTransportRoute extends TransportRoute {
  path: Array<[number, number]>;
  importance: number;
}

interface QueryResult {
  id: string;
  metadata: {
    name: string;
    location: [number, number];
    visitorCount: number;
    culturalSignificance: number;
    eventFrequency: number;
    nearbyAttractions?: Array<{
      name: string;
      type: string;
      location: [number, number];
      distance: number;
    }>;
  };
}

interface CulturalHotspot {
  id: string;
  name: string;
  location: [number, number];
  visitorCount: number;
  culturalSignificance: number;
  eventFrequency: number;
  nearbyAttractions: Array<{
    name: string;
    type: string;
    location: [number, number];
    distance: number;
  }>;
}

interface RouteAdjustment {
  location: [number, number];
  priority: number;
  suggestedStops: {
    primaryStop: {
      name: string;
      coordinates: [number, number];
      type: string;
    };
    nearbyAttractions: Array<{
      name: string;
      type: string;
      location: [number, number];
    }>;
  };
}

interface CulturalEvent {
  id: string;
  name: string;
  location: [number, number];
  startTime: number;
  endTime: number;
  expectedAttendance: number;
  type: string;
  impact: {
    radius: number;
    intensity: number;
  };
}

export class CulturalTransportService extends EventEmitter {
  constructor(
    private cultureService: CultureService,
    private transportService: TransportService,
    private vectorStore: VectorStoreService,
    private analyticsService: AnalyticsService
  ) {
    super();
    this.initializeCulturalRoutes();
  }

  private async initializeCulturalRoutes() {
    try {
      await this.optimizeRoutes();
      setInterval(() => this.optimizeRoutes(), 1000 * 60 * 60); // Hourly

      this.cultureService.on(
        "culturalEventCreated",
        this.adjustRoutes.bind(this)
      );
      this.analyticsService.trackEvent("cultural_transport_initialized", {
        timestamp: Date.now(),
        status: "success",
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.analyticsService.trackEvent(
          "cultural_transport_initialization_failed",
          {
            timestamp: Date.now(),
            error: error.message,
          }
        );
        console.error("Failed to initialize cultural routes:", error.message);
      }
    }
  }

  private async optimizeRoutes() {
    try {
      const culturalHotspots = await this.identifyCulturalHotspots();
      const routeAdjustments = this.calculateRouteAdjustments(culturalHotspots);

      await this.transportService.updateRoutes(routeAdjustments);

      this.analyticsService.trackEvent("routes_optimized", {
        timestamp: Date.now(),
        hotspotCount: culturalHotspots.length,
        adjustmentCount: routeAdjustments.length,
      });
    } catch (error) {
      this.emit("route:optimization:failed", error);
      throw error;
    }
  }

  private async identifyCulturalHotspots(): Promise<CulturalHotspot[]> {
    const embedding = await this.vectorStore.createEmbedding(
      "cultural hotspots active events"
    );

    const results = (await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "transport" },
        subtype: { $eq: "cultural_hotspot" },
      },
      topK: 10,
    })) as QueryResult[];

    return results.map((result: QueryResult) => ({
      id: result.id,
      name: result.metadata.name,
      location: result.metadata.location,
      visitorCount: result.metadata.visitorCount,
      culturalSignificance: result.metadata.culturalSignificance,
      eventFrequency: result.metadata.eventFrequency,
      nearbyAttractions: result.metadata.nearbyAttractions || [],
    }));
  }

  private calculateRouteAdjustments(
    hotspots: CulturalHotspot[]
  ): RouteAdjustment[] {
    return hotspots.map((hotspot) => ({
      location: hotspot.location,
      priority: this.calculateHotspotPriority(hotspot),
      suggestedStops: this.generateStopSuggestions(hotspot),
    }));
  }

  private calculateHotspotPriority(hotspot: CulturalHotspot): number {
    return (
      hotspot.visitorCount * 0.4 +
      hotspot.culturalSignificance * 0.3 +
      hotspot.eventFrequency * 0.3
    );
  }

  private generateStopSuggestions(hotspot: CulturalHotspot) {
    return {
      primaryStop: {
        name: hotspot.name,
        coordinates: hotspot.location,
        type: "cultural_destination",
      },
      nearbyAttractions: hotspot.nearbyAttractions,
    };
  }

  async findImpactedRoutes(
    location: [number, number],
    radius: number
  ): Promise<CulturalTransportRoute[]> {
    try {
      const routes = await this.transportService.getNearbyRoutes(
        location,
        radius
      );
      return routes
        .map((route) => {
          // Transform TransportRoute to CulturalTransportRoute
          const culturalRoute: CulturalTransportRoute = {
            ...route,
            // Generate path from stops
            path: route.stops.map((stop) => stop.location.coordinates),
            // Calculate importance based on cultural factors
            importance: this.calculateRouteImportance(route, location),
          };
          return culturalRoute;
        })
        .filter(
          (route) => this.calculateRouteImpact(route, location, radius) > 0.3
        );
    } catch (error) {
      this.emit("route:impact:analysis:failed", error);
      throw error;
    }
  }

  private calculateRouteImportance(
    route: TransportRoute,
    location: [number, number]
  ): number {
    // Calculate importance based on:
    // 1. Distance to cultural location
    // 2. Number of cultural stops on the route
    // 3. Current utilization
    // 4. Route efficiency

    const nearestStopDistance = Math.min(
      ...route.stops.map((stop) =>
        this.calculateDistance(stop.location.coordinates, location)
      )
    );

    const culturalStopsCount = route.stops.filter(
      (stop) => stop.type?.includes("cultural") || stop.type?.includes("event")
    ).length;

    const distanceScore = Math.max(0, 1 - nearestStopDistance / 5000); // Normalize to 5km
    const culturalScore = Math.min(1, culturalStopsCount / 5); // Normalize to 5 cultural stops
    const utilizationScore = route.metrics.utilization;
    const efficiencyScore = route.metrics.efficiency;

    return (
      distanceScore * 0.3 +
      culturalScore * 0.3 +
      utilizationScore * 0.2 +
      efficiencyScore * 0.2
    );
  }

  private calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  private calculateRouteImpact(
    route: CulturalTransportRoute,
    location: [number, number],
    radius: number
  ): number {
    return route.importance * 0.5; // Improved placeholder implementation
  }

  async createEventBasedAdjustments(
    event: CulturalEvent,
    routes: CulturalTransportRoute[]
  ) {
    try {
      const adjustments = routes.map((route) => ({
        routeId: route.id,
        adjustmentType:
          event.expectedAttendance > 1000
            ? ("major" as const)
            : ("minor" as const),
        temporaryStops: this.generateEventStops(event),
        timeWindow: {
          start: event.startTime - 1800000, // 30 minutes before
          end: event.endTime + 1800000, // 30 minutes after
        },
        priority: this.calculateEventPriority(event),
      }));

      this.analyticsService.trackEvent("event_adjustments_created", {
        eventId: event.id,
        adjustmentCount: adjustments.length,
        timestamp: Date.now(),
      });

      return adjustments;
    } catch (error) {
      this.emit("route:adjustment:creation:failed", error);
      throw error;
    }
  }

  private generateEventStops(event: CulturalEvent) {
    return [
      {
        name: event.name,
        coordinates: event.location,
        type: "event_stop",
        duration: event.endTime - event.startTime,
      },
    ];
  }

  private calculateEventPriority(event: CulturalEvent): number {
    return Math.min(
      1,
      (event.expectedAttendance / 1000) * 0.5 + event.impact.intensity * 0.5
    );
  }

  private async adjustRoutes(event: CulturalEvent) {
    try {
      const impactedRoutes = await this.findImpactedRoutes(
        event.location,
        event.impact.radius
      );
      const adjustments = await this.createEventBasedAdjustments(
        event,
        impactedRoutes
      );

      await this.transportService.modifyRoutes(adjustments);

      this.analyticsService.trackEvent("routes_adjusted", {
        eventId: event.id,
        impactedRoutes: impactedRoutes.length,
        adjustments: adjustments.length,
        timestamp: Date.now(),
      });

      this.emit("routes:adjusted", { event, adjustments });
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.emit("route:adjustment:failed", { event, error: error.message });
      }
      throw error;
    }
  }
}
