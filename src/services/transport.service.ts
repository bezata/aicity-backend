import { EventEmitter } from "events";
import {
  TransportRoute,
  TransportStop,
  TransportMode,
  RouteSchedule,
  TimeSlot,
  RouteAdjustment,
  TemporaryRouteAdjustment,
} from "../types/transport.types";
import { VectorStoreService } from "./vector-store.service";
import { WeatherService } from "./weather.service";
import { CityRhythmService } from "./city-rhythm.service";
import { EmergencyService } from "./emergency.service";
import { DistrictService } from "./district.service";
import { MetricsService } from "./metrics.service";

export class TransportService extends EventEmitter {
  private routes: Map<string, TransportRoute> = new Map();
  private stops: Map<string, TransportStop> = new Map();
  private systemEfficiency: number = 1.0;
  private updateInterval!: NodeJS.Timer;

  constructor(
    private vectorStore: VectorStoreService,
    private weatherService: WeatherService,
    private cityRhythmService: CityRhythmService,
    private emergencyService: EmergencyService,
    private districtService: DistrictService,
    private metricsService: MetricsService
  ) {
    super();
    this.initializeTransportSystem();
    this.setupEventListeners();
    this.startMetricsTracking();
  }

  private async initializeTransportSystem() {
    // Initialize basic routes and stops
    await this.generateBaseNetwork();

    // Start simulation cycles
    setInterval(() => this.updateTransportMetrics(), 1000 * 60 * 5); // Every 5 minutes
    setInterval(() => this.simulatePassengerFlow(), 1000 * 60); // Every minute
  }

  private setupEventListeners() {
    this.weatherService.on(
      "weatherChanged",
      this.handleWeatherChange.bind(this)
    );
    this.cityRhythmService.on("rhythmUpdated", this.adjustService.bind(this));
    this.emergencyService.on(
      "emergencyResponse",
      this.handleEmergency.bind(this)
    );
  }

  async adjustEfficiency(factor: number) {
    this.systemEfficiency = Math.max(0.3, Math.min(1, factor));
    await this.updateRouteEfficiencies();
  }

  private async updateRouteEfficiencies() {
    for (const route of this.routes.values()) {
      const updatedRoute = {
        ...route,
        metrics: {
          ...route.metrics,
          efficiency: route.metrics.efficiency * this.systemEfficiency,
        },
      };
      this.routes.set(route.id, updatedRoute);
      await this.storeRouteUpdate(updatedRoute);
    }
  }

  private async storeRouteUpdate(route: TransportRoute) {
    await this.vectorStore.upsert({
      id: `transport-route-${route.id}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `${route.mode} route ${route.name} with efficiency ${route.metrics.efficiency}`
      ),
      metadata: {
        type: "district",
        routeId: route.id,
        mode: route.mode,
        efficiency: route.metrics.efficiency,
        timestamp: Date.now(),
      },
    });
  }

  private async generateBaseNetwork() {
    const modes: TransportMode[] = ["bus", "subway", "tram"];
    modes.forEach((mode) => {
      for (let i = 0; i < this.getRouteCount(mode); i++) {
        const route = this.createRoute(mode);
        this.routes.set(route.id, route);
      }
    });
  }

  private createRoute(mode: TransportMode): TransportRoute {
    return {
      id: crypto.randomUUID(),
      mode,
      type:
        mode === "subway"
          ? "metro"
          : (mode as "bus" | "train" | "tram" | "metro"),
      name: `${mode.charAt(0).toUpperCase()}${mode.slice(1)} Route`,
      stops: [],
      schedule: this.generateSchedule(mode),
      status: "active",
      capacity: this.getBaseCapacity(mode),
      metrics: {
        reliability: 0.9,
        satisfaction: 0.8,
        efficiency: 1.0,
        utilization: 0.0,
      },
    };
  }

  private getRouteCount(mode: TransportMode): number {
    const counts: Record<TransportMode, number> = {
      bus: 10,
      subway: 3,
      tram: 5,
      bike: 0,
      pedestrian: 0,
      car: 0,
    };
    return counts[mode];
  }

  private getBaseCapacity(mode: TransportMode): TransportRoute["capacity"] {
    const capacities: Record<TransportMode, number> = {
      bus: 50,
      subway: 200,
      tram: 100,
      bike: 1,
      pedestrian: 1,
      car: 5,
    };
    return {
      max: capacities[mode],
      current: 0,
    };
  }

  private generateSchedule(mode: TransportMode): RouteSchedule {
    return {
      weekday: [
        { start: 6, end: 9, frequency: 10, capacity: 1.0 }, // Morning peak
        { start: 9, end: 16, frequency: 15, capacity: 0.7 }, // Off-peak
        { start: 16, end: 19, frequency: 10, capacity: 1.0 }, // Evening peak
        { start: 19, end: 23, frequency: 20, capacity: 0.5 }, // Night
      ],
      weekend: [{ start: 8, end: 23, frequency: 20, capacity: 0.6 }],
      frequency: mode === "subway" ? 5 : mode === "tram" ? 10 : 15,
      lastUpdated: Date.now(),
    };
  }

  private async updateTransportMetrics() {
    const routes = Array.from(this.routes.values());

    // Calculate average metrics
    const avgEfficiency =
      routes.reduce((sum, r) => sum + r.metrics.efficiency, 0) / routes.length;
    const avgReliability =
      routes.reduce((sum, r) => sum + r.metrics.reliability, 0) / routes.length;
    const avgSatisfaction =
      routes.reduce((sum, r) => sum + r.metrics.satisfaction, 0) /
      routes.length;

    // Calculate congestion based on route utilization
    const congestionLevel = 1 - avgEfficiency;

    // Update central metrics service
    await this.metricsService.updateMetrics({
      infrastructure: {
        trafficCongestion: congestionLevel,
        publicTransitReliability: avgReliability,
        infrastructureHealth: avgEfficiency,
        smartGridEfficiency: this.systemEfficiency,
        wasteRecyclingRate: 0.6, // Default value
      },
    });

    // Update route metrics
    for (const route of routes) {
      const metrics = await this.calculateRouteMetrics(route);
      const updatedRoute = { ...route, metrics };
      this.routes.set(route.id, updatedRoute);
    }

    this.emit("metricsUpdated", {
      efficiency: avgEfficiency,
      reliability: avgReliability,
      satisfaction: avgSatisfaction,
      congestion: congestionLevel,
    });
  }

  private async calculateRouteMetrics(route: TransportRoute) {
    const weather = this.weatherService.getCurrentWeather();
    const weatherImpact = weather ? 1 - weather.severity * 0.3 : 1;

    return {
      reliability: route.metrics.reliability * weatherImpact,
      satisfaction: route.metrics.satisfaction * this.systemEfficiency,
      efficiency:
        route.metrics.efficiency * this.systemEfficiency * weatherImpact,
      utilization: route.capacity.current / route.capacity.max,
    };
  }

  private async simulatePassengerFlow() {
    const hour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());

    for (const route of this.routes.values()) {
      const schedule = isWeekend
        ? route.schedule.weekend
        : route.schedule.weekday;
      const timeSlot = schedule.find(
        (slot) => hour >= slot.start && hour < slot.end
      );

      if (timeSlot) {
        const baseFlow = route.capacity.max * timeSlot.capacity;
        const actualFlow = baseFlow * this.systemEfficiency;

        const updatedRoute = {
          ...route,
          capacity: {
            ...route.capacity,
            current: Math.min(route.capacity.max, actualFlow),
          },
        };
        this.routes.set(route.id, updatedRoute);
      }
    }
  }

  private async handleWeatherChange(weather: any) {
    if (weather.severity > 0.5) {
      const impactedModes = this.getWeatherImpactedModes(weather.type);
      await this.adjustServiceForWeather(impactedModes, weather.severity);
    }
  }

  private getWeatherImpactedModes(weatherType: string): TransportMode[] {
    const impacts: Record<string, TransportMode[]> = {
      rain: ["bike", "pedestrian"],
      snow: ["bus", "bike", "pedestrian"],
      storm: ["bus", "tram", "bike", "pedestrian"],
      heat: ["pedestrian"],
    };
    return impacts[weatherType] || [];
  }

  private async adjustServiceForWeather(
    modes: TransportMode[],
    severity: number
  ) {
    for (const route of this.routes.values()) {
      if (modes.includes(route.mode)) {
        const updatedRoute: TransportRoute = {
          ...route,
          status: severity > 0.8 ? "suspended" : "delayed",
          metrics: {
            ...route.metrics,
            efficiency: route.metrics.efficiency * (1 - severity * 0.5),
          },
        };
        this.routes.set(route.id, updatedRoute);
      }
    }
  }

  private async handleEmergency(emergency: any) {
    const affectedRoutes = this.findRoutesInArea(emergency.affectedArea);
    for (const route of affectedRoutes) {
      const updatedRoute: TransportRoute = {
        ...route,
        status: "delayed" as const,
        metrics: {
          ...route.metrics,
          efficiency: route.metrics.efficiency * 0.7,
        },
      };
      this.routes.set(route.id, updatedRoute);
    }
  }

  private findRoutesInArea(area: any): TransportRoute[] {
    // Implementation to find routes within affected area
    return Array.from(this.routes.values()).filter((route) =>
      route.stops.some((stop) =>
        area.districtIds.includes(stop.location.districtId)
      )
    );
  }

  private createDefaultRoutes(): TransportRoute[] {
    return [
      {
        id: crypto.randomUUID(),
        mode: "bus" as TransportMode,
        name: "Downtown Express",
        type: "bus",
        stops: [],
        schedule: this.createDefaultSchedule(),
        status: "active" as const,
        capacity: {
          max: 50,
          current: 0,
        },
        metrics: {
          reliability: 0.9,
          satisfaction: 0.85,
          efficiency: 0.8,
          utilization: 0,
        },
      },
      // ... other routes
    ];
  }

  async updateRouteMetrics(routeId: string): Promise<void> {
    const route = this.routes.get(routeId);
    if (!route) return;

    const newStatus = this.determineRouteStatus(route) as
      | "active"
      | "delayed"
      | "suspended";

    const updatedRoute: TransportRoute = {
      ...route,
      status: newStatus,
      metrics: {
        reliability: this.calculateReliability(route),
        efficiency: this.calculateEfficiency(route),
        utilization: this.calculateUtilization(route),
        satisfaction: this.calculateSatisfaction(route),
      },
    };

    await this.adjustService(routeId, updatedRoute);
  }

  private determineRouteStatus(
    route: TransportRoute
  ): "active" | "delayed" | "suspended" {
    const reliability = this.calculateReliability(route);
    if (reliability < 0.3) return "suspended";
    if (reliability < 0.7) return "delayed";
    return "active";
  }

  private calculateReliability(route: TransportRoute): number {
    // Calculate reliability based on:
    // 1. Historical schedule adherence
    // 2. Current weather impact
    // 3. System efficiency
    // 4. Route complexity (number of stops)

    const baseReliability = 0.95; // Start with high base reliability
    const weatherImpact =
      this.weatherService.getCurrentWeather()?.severity || 0;
    const stopComplexityFactor = Math.max(0.7, 1 - route.stops.length * 0.02); // More stops = more chances for delays

    const reliability =
      baseReliability *
      (1 - weatherImpact * 0.3) * // Weather impact reduces reliability by up to 30%
      this.systemEfficiency * // System efficiency directly affects reliability
      stopComplexityFactor; // Route complexity impact

    return Math.max(0.3, Math.min(1, reliability)); // Clamp between 0.3 and 1
  }

  private calculateEfficiency(route: TransportRoute): number {
    // Calculate efficiency based on:
    // 1. Current utilization vs capacity
    // 2. Energy consumption (based on mode)
    // 3. Route directness
    // 4. System efficiency

    const utilizationScore = this.calculateUtilization(route);
    const modeEfficiency = this.getModeEfficiency(route.mode);

    // Calculate route directness (simplified)
    const directness =
      route.stops.length > 1
        ? this.calculateRouteDirectness(
            route.stops.map((stop) => stop.location.coordinates)
          )
        : 1;

    const efficiency =
      (utilizationScore * 0.4 + // 40% weight on utilization
        modeEfficiency * 0.3 + // 30% weight on mode efficiency
        directness * 0.3) * // 30% weight on route directness
      this.systemEfficiency;

    return Math.max(0.3, Math.min(1, efficiency));
  }

  private calculateUtilization(route: TransportRoute): number {
    // Calculate utilization based on:
    // 1. Current capacity vs max capacity
    // 2. Time of day adjustment
    // 3. Day of week adjustment

    const baseUtilization = route.capacity.current / route.capacity.max;
    const hour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());

    // Get the current time slot's expected capacity
    const schedule = isWeekend
      ? route.schedule.weekend
      : route.schedule.weekday;
    const timeSlot = schedule.find(
      (slot) => hour >= slot.start && hour < slot.end
    );
    const expectedCapacity = timeSlot ? timeSlot.capacity : 0.5;

    // Adjust utilization based on expected capacity for the time period
    const adjustedUtilization = baseUtilization / expectedCapacity;

    return Math.max(0, Math.min(1, adjustedUtilization));
  }

  private calculateSatisfaction(route: TransportRoute): number {
    // Calculate satisfaction based on:
    // 1. Route reliability
    // 2. Crowding levels
    // 3. Service frequency
    // 4. Comfort factors

    const reliability = this.calculateReliability(route);
    const crowdingFactor = 1 - this.calculateUtilization(route) * 0.5; // Higher utilization reduces satisfaction

    // Calculate frequency satisfaction
    const hour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    const schedule = isWeekend
      ? route.schedule.weekend
      : route.schedule.weekday;
    const timeSlot = schedule.find(
      (slot) => hour >= slot.start && hour < slot.end
    );
    const frequencySatisfaction = timeSlot
      ? Math.max(0.5, 1 - (timeSlot.frequency / 60) * 0.5)
      : 0.5; // Lower frequency = lower satisfaction

    // Calculate comfort based on mode
    const comfortFactor = this.getModeComfort(route.mode);

    const satisfaction =
      reliability * 0.3 + // 30% weight on reliability
      crowdingFactor * 0.3 + // 30% weight on crowding
      frequencySatisfaction * 0.2 + // 20% weight on frequency
      comfortFactor * 0.2; // 20% weight on comfort

    return Math.max(0.3, Math.min(1, satisfaction));
  }

  private getModeEfficiency(mode: TransportMode): number {
    // Higher numbers indicate more efficient modes
    const efficiencies: Record<TransportMode, number> = {
      subway: 0.95, // Most efficient due to electric power and high capacity
      tram: 0.9, // Very efficient, electric
      bus: 0.7, // Less efficient, but flexible
      bike: 1.0, // Most environmentally efficient
      pedestrian: 1.0, // Perfect efficiency
      car: 0.5, // Least efficient for city transport
    };
    return efficiencies[mode];
  }

  private getModeComfort(mode: TransportMode): number {
    // Higher numbers indicate more comfortable modes
    const comfort: Record<TransportMode, number> = {
      subway: 0.8, // Fast but can be crowded
      tram: 0.85, // Smooth ride, good views
      bus: 0.75, // More stops, affected by traffic
      bike: 0.7, // Weather dependent
      pedestrian: 0.9, // Most control but weather dependent
      car: 0.95, // Most comfortable but traffic issues
    };
    return comfort[mode];
  }

  private calculateRouteDirectness(coordinates: [number, number][]): number {
    if (coordinates.length < 2) return 1;

    // Calculate actual route distance
    let actualDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      actualDistance += this.calculateDistance(
        coordinates[i - 1],
        coordinates[i]
      );
    }

    // Calculate direct distance between start and end
    const directDistance = this.calculateDistance(
      coordinates[0],
      coordinates[coordinates.length - 1]
    );

    // Directness ratio (direct distance / actual distance)
    // Higher ratio = more direct route
    const directness = directDistance / actualDistance;

    return Math.max(0.5, Math.min(1, directness));
  }

  private createDefaultSchedule(): RouteSchedule {
    return {
      weekday: [
        { start: 6, end: 9, frequency: 15, capacity: 50 },
        { start: 9, end: 16, frequency: 30, capacity: 40 },
        { start: 16, end: 19, frequency: 15, capacity: 50 },
        { start: 19, end: 23, frequency: 30, capacity: 30 },
      ],
      weekend: [
        { start: 8, end: 12, frequency: 30, capacity: 40 },
        { start: 12, end: 20, frequency: 45, capacity: 30 },
      ],
      frequency: 30,
      lastUpdated: Date.now(),
    };
  }

  async updateRoutes(adjustments: RouteAdjustment[]) {
    try {
      for (const adjustment of adjustments) {
        const nearbyRoutes = await this.getNearbyRoutes(
          adjustment.location,
          1000
        ); // 1km radius
        for (const route of nearbyRoutes) {
          const districtId = await this.findNearestDistrict(
            adjustment.suggestedStops.primaryStop.coordinates
          );
          const updatedRoute: TransportRoute = {
            ...route,
            stops: [
              ...route.stops,
              {
                id: crypto.randomUUID(),
                name: adjustment.suggestedStops.primaryStop.name,
                location: {
                  coordinates:
                    adjustment.suggestedStops.primaryStop.coordinates,
                  districtId,
                },
                type: adjustment.suggestedStops.primaryStop.type,
                priority: adjustment.priority,
                routes: [route.id],
                facilities: [],
                crowding: 0,
              },
            ],
            metrics: {
              ...route.metrics,
              efficiency: route.metrics.efficiency * 0.9, // Temporary efficiency drop due to adjustment
            },
          };
          this.routes.set(route.id, updatedRoute);
          await this.storeRouteUpdate(updatedRoute);
        }
      }
      this.emit("routes:updated", adjustments);
    } catch (error) {
      console.error("Failed to update routes:", error);
      throw error;
    }
  }

  async modifyRoutes(adjustments: TemporaryRouteAdjustment[]) {
    try {
      for (const adjustment of adjustments) {
        const route = this.routes.get(adjustment.routeId);
        if (!route) continue;

        const updatedStops = [...route.stops];
        if (adjustment.temporaryStops) {
          for (const stop of adjustment.temporaryStops) {
            const districtId = await this.findNearestDistrict(stop.coordinates);
            updatedStops.push({
              id: crypto.randomUUID(),
              name: stop.name,
              location: {
                coordinates: stop.coordinates,
                districtId,
              },
              type: stop.type,
              temporary: true,
              duration: stop.duration,
              routes: [route.id],
              facilities: [],
              crowding: 0,
            });
          }
        }

        const updatedRoute: TransportRoute = {
          ...route,
          stops: updatedStops,
          metrics: {
            ...route.metrics,
            efficiency:
              route.metrics.efficiency *
              (adjustment.adjustmentType === "major" ? 0.7 : 0.9),
          },
        };

        this.routes.set(route.id, updatedRoute);
        await this.storeRouteUpdate(updatedRoute);
      }
      this.emit("routes:modified", adjustments);
    } catch (error) {
      console.error("Failed to modify routes:", error);
      throw error;
    }
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

  private async findNearestDistrict(
    location: [number, number]
  ): Promise<string> {
    try {
      // Get all districts from the district service
      const districts = await this.districtService.getAllDistricts();

      // Find the nearest district by calculating distance to each district's center coordinates
      let nearestDistrict = null;
      let shortestDistance = Infinity;

      for (const district of districts) {
        // Get district coordinates from district service
        const districtCoords =
          await this.districtService.getDistrictCoordinates(district.id);
        if (!districtCoords) continue;

        const distance = this.calculateDistance(location, districtCoords);

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestDistrict = district;
        }
      }

      // If no district found, return a default value
      if (!nearestDistrict) {
        console.warn(`No nearest district found for location [${location}]`);
        return "downtown";
      }

      return nearestDistrict.id;
    } catch (error) {
      console.error("Error finding nearest district:", error);
      return "downtown"; // Fallback to default
    }
  }

  async getNearbyRoutes(
    location: [number, number],
    radius: number
  ): Promise<TransportRoute[]> {
    try {
      // Calculate distance between route stops and target location
      return Array.from(this.routes.values()).filter((route) => {
        return route.stops.some((stop) => {
          const distance = this.calculateDistance(
            stop.location.coordinates,
            location
          );
          return distance <= radius;
        });
      });
    } catch (error) {
      console.error("Failed to get nearby routes:", error);
      throw error;
    }
  }

  private startMetricsTracking() {
    // Update metrics every 5 minutes
    setInterval(() => this.updateTransportMetrics(), 5 * 60 * 1000);
  }
}
