import { EventEmitter } from "events";
import {
  SmartSystem,
  DistrictInfrastructure,
  SystemType,
} from "../types/smart-infrastructure.types";
import { VectorStoreService } from "./vector-store.service";
import { MetricsService } from "./metrics.service";
import { TransportService } from "./transport.service";

export class SmartInfrastructureService extends EventEmitter {
  private systems: Map<string, SmartSystem> = new Map();
  private districts: Map<string, DistrictInfrastructure[]> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private metricsService: MetricsService,
    private transportService?: TransportService
  ) {
    super();
    this.initializeMetricsTracking();
    this.setupEventListeners();
    this.initializeDefaultSystems();
  }

  private setupEventListeners() {
    // Listen for transport metrics updates to coordinate infrastructure metrics
    this.transportService?.on("metricsUpdated", (transportMetrics) => {
      this.updateInfrastructureMetrics(transportMetrics);
    });
  }

  private initializeMetricsTracking() {
    // Update metrics every 5 minutes
    setInterval(() => this.updateInfrastructureMetrics(), 5 * 60 * 1000);
  }

  private async updateInfrastructureMetrics(transportMetrics?: any) {
    const powerSystems = Array.from(this.systems.values()).filter(
      (s) => s.type === "power"
    );
    const waterSystems = Array.from(this.systems.values()).filter(
      (s) => s.type === "water"
    );

    const avgPowerEfficiency = powerSystems.length
      ? powerSystems.reduce((sum, s) => sum + s.metrics.efficiency, 0) /
        powerSystems.length
      : 0.8;

    const avgWaterEfficiency = waterSystems.length
      ? waterSystems.reduce((sum, s) => sum + s.metrics.efficiency, 0) /
        waterSystems.length
      : 0.8;

    const transportSystems = Array.from(this.systems.values()).filter(
      (s) => s.type === "transportation"
    );
    const avgTransportEfficiency = transportMetrics
      ? transportMetrics.efficiency
      : transportSystems.reduce((sum, s) => sum + s.metrics.efficiency, 0) /
        Math.max(transportSystems.length, 1);

    await this.metricsService.updateMetrics({
      infrastructure: {
        maintenanceRequests: 23,
        serviceUptime: 0.99,
        healthScore:
          (avgTransportEfficiency + avgPowerEfficiency + avgWaterEfficiency) /
          3,
        developmentProgress: 0.8,
        wasteRecyclingRate: 0.6,
        smartGridEfficiency: avgPowerEfficiency,
      },
    });
  }

  async getSystemStatus(): Promise<SmartSystem[]> {
    return Array.from(this.systems.values());
  }

  async getDistrictInfrastructure(
    districtId: string
  ): Promise<DistrictInfrastructure> {
    const systems = Array.from(this.systems.values()).filter(
      (system) => system.location.districtId === districtId
    );

    return {
      id: `infra-${districtId}`,
      districtId,
      systems,
      status: "operational",
      lastUpdate: Date.now(),
      resources: {
        water: {
          consumption: this.calculateResourceConsumption(systems, "water"),
          capacity: this.calculateResourceCapacity(systems, "water"),
        },
        power: {
          consumption: this.calculateResourceConsumption(systems, "power"),
          capacity: this.calculateResourceCapacity(systems, "power"),
        },
        data: {
          usage: this.calculateResourceConsumption(systems, "digital"),
          capacity: this.calculateResourceCapacity(systems, "digital"),
        },
      },
    };
  }

  private calculateResourceConsumption(
    systems: SmartSystem[],
    type: SystemType
  ): number {
    const typeSystems = systems.filter((s) => s.type === type);
    return typeSystems.reduce((sum, s) => sum + (s.consumption || 0), 0);
  }

  private calculateResourceCapacity(
    systems: SmartSystem[],
    type: SystemType
  ): number {
    const typeSystems = systems.filter((s) => s.type === type);
    return typeSystems.reduce((sum, s) => sum + (s.generation || 100), 0);
  }

  private calculateTransportationScore(systems: SmartSystem[]): number {
    const transportSystems = systems.filter(
      (s) => s.type === "transportation" || s.type === "traffic"
    );
    return transportSystems.length > 0
      ? transportSystems.reduce((sum, s) => sum + s.metrics.efficiency, 0) /
          transportSystems.length
      : 0.5;
  }

  private calculateDigitalConnectivity(systems: SmartSystem[]): number {
    const digitalSystems = systems.filter((s) => s.type === "digital");
    return digitalSystems.length > 0
      ? digitalSystems.reduce(
          (sum, s) => sum + (s.metrics.connectivity || 0),
          0
        ) / digitalSystems.length
      : 0.5;
  }

  private calculatePedestrianAccess(systems: SmartSystem[]): number {
    const accessSystems = systems.filter((s) => s.type === "pedestrian");
    return accessSystems.length > 0
      ? accessSystems.reduce(
          (sum, s) => sum + (s.metrics.accessibility || 0),
          0
        ) / accessSystems.length
      : 0.5;
  }

  async getNearbyInfrastructure(coordinates: [number, number]) {
    try {
      // Query infrastructure data near the given coordinates
      const results = await this.vectorStore.query({
        vector: await this.vectorStore.createEmbedding(
          `infrastructure near ${coordinates.join(",")}`
        ),
        filter: {
          type: { $eq: "infrastructure" },
        },
        topK: 5,
      });

      if (!results.matches?.length) return null;

      // Return the nearest infrastructure
      return {
        type: results.matches[0].metadata.type,
        status: results.matches[0].metadata.status,
        coordinates: JSON.parse(results.matches[0].metadata.coordinates),
      };
    } catch (error) {
      console.error("Error getting nearby infrastructure:", error);
      return null;
    }
  }

  private async initializeDefaultSystems() {
    // Initialize power systems
    this.systems.set("power-grid-1", {
      id: "power-grid-1",
      type: "power",
      status: "active",
      location: { districtId: "main", coordinates: [0, 0] },
      consumption: 0.6,
      generation: 100,
      metrics: {
        utilization: 0.6,
        efficiency: 0.85,
      },
    });

    // Initialize water systems
    this.systems.set("water-system-1", {
      id: "water-system-1",
      type: "water",
      status: "active",
      location: { districtId: "main", coordinates: [0, 0] },
      consumption: 0.5,
      generation: 100,
      metrics: {
        utilization: 0.5,
        efficiency: 0.9,
      },
    });

    // Initialize digital systems
    this.systems.set("digital-network-1", {
      id: "digital-network-1",
      type: "digital",
      status: "active",
      location: { districtId: "main", coordinates: [0, 0] },
      consumption: 0.4,
      generation: 100,
      metrics: {
        utilization: 0.4,
        efficiency: 0.88,
        connectivity: 0.92,
      },
    });

    // Initialize transportation systems
    this.systems.set("transport-system-1", {
      id: "transport-system-1",
      type: "transportation",
      status: "active",
      location: { districtId: "main", coordinates: [0, 0] },
      consumption: 0.55,
      generation: 100,
      metrics: {
        utilization: 0.55,
        efficiency: 0.82,
        accessibility: 0.85,
      },
    });

    // Initialize waste management systems
    this.systems.set("waste-system-1", {
      id: "waste-system-1",
      type: "waste",
      status: "active",
      location: { districtId: "main", coordinates: [0, 0] },
      consumption: 0.3,
      generation: 100,
      metrics: {
        utilization: 0.3,
        efficiency: 0.75,
      },
    });

    console.log(
      `Initialized ${this.systems.size} smart infrastructure systems`
    );
  }
}
