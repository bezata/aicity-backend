import { EventEmitter } from "events";
import {
  SmartSystem,
  DistrictInfrastructure,
  SystemType,
} from "../types/smart-infrastructure.types";

export class SmartInfrastructureService extends EventEmitter {
  private systems: Map<string, SmartSystem> = new Map();

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
}
