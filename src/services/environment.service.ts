import { EventEmitter } from "events";
import { EnvironmentalAlert } from "../types/environment.types";

export class EnvironmentService extends EventEmitter {
  private activeAlerts = new Set<EnvironmentalAlert>();

  getActiveAlerts(): Set<EnvironmentalAlert> {
    return this.activeAlerts;
  }

  async getEnvironmentalMetrics() {
    return {
      airQuality: 0.8,
      greenCoverage: 0.4,
      sustainability: 0.6,
      emissions: 0.5,
      waterQuality: 0.7,
      noiseLevel: 0.4,
    };
  }
}
