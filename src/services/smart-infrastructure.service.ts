import { EventEmitter } from "events";
import { SmartSystem } from "../types/smart-infrastructure.types";

interface DistrictInfrastructure {
  transportationScore: number;
  digitalConnectivity: number;
  pedestrianAccess: number;
  systems: SmartSystem[];
}

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
      transportationScore: this.calculateTransportationScore(systems),
      digitalConnectivity: this.calculateDigitalConnectivity(systems),
      pedestrianAccess: this.calculatePedestrianAccess(systems),
      systems,
    };
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
      ? digitalSystems.reduce((sum, s) => sum + s.metrics.connectivity, 0) /
          digitalSystems.length
      : 0.5;
  }

  private calculatePedestrianAccess(systems: SmartSystem[]): number {
    const accessSystems = systems.filter((s) => s.type === "pedestrian");
    return accessSystems.length > 0
      ? accessSystems.reduce((sum, s) => sum + s.metrics.accessibility, 0) /
          accessSystems.length
      : 0.5;
  }
}
