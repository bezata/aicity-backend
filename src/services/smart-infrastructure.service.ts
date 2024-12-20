import { EventEmitter } from "events";
import { SmartSystem } from "../types/smart-infrastructure.types";

export class SmartInfrastructureService extends EventEmitter {
  private systems: Map<string, SmartSystem> = new Map();

  async getSystemStatus(): Promise<SmartSystem[]> {
    return Array.from(this.systems.values());
  }
}
