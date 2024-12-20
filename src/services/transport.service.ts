import { EventEmitter } from "events";
import {
  TransportRoute,
  TransportStop,
  TransportMode,
  RouteSchedule,
  TimeSlot,
} from "../types/transport.types";
import { VectorStoreService } from "./vector-store.service";
import { WeatherService } from "./weather.service";
import { CityRhythmService } from "./city-rhythm.service";
import { EmergencyService } from "./emergency.service";

export class TransportService extends EventEmitter {
  private routes: Map<string, TransportRoute> = new Map();
  private stops: Map<string, TransportStop> = new Map();
  private systemEfficiency: number = 1.0;

  constructor(
    private vectorStore: VectorStoreService,
    private weatherService: WeatherService,
    private cityRhythmService: CityRhythmService,
    private emergencyService: EmergencyService
  ) {
    super();
    this.initializeTransportSystem();
    this.setupEventListeners();
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
    for (const route of this.routes.values()) {
      const metrics = await this.calculateRouteMetrics(route);
      const updatedRoute = { ...route, metrics };
      this.routes.set(route.id, updatedRoute);
    }
    this.emit("metricsUpdated", Array.from(this.routes.values()));
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
    // Implementation based on schedule adherence
    return 0.85;
  }

  private calculateEfficiency(route: TransportRoute): number {
    // Implementation based on resource utilization
    return 0.8;
  }

  private calculateUtilization(route: TransportRoute): number {
    return route.capacity.current / route.capacity.max;
  }

  private calculateSatisfaction(route: TransportRoute): number {
    // Implementation based on user feedback and performance
    return 0.75;
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
}
