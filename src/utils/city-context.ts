import { CityContext, CityMetric, CityUpdate } from "../types/city.types";
import { District } from "../types/district.types";
import { Agent } from "../types/agent.types";
import { CityEvent } from "../types/city-events";

export class CityContextManager {
  private context: CityContext;
  private updateCallbacks: ((update: CityUpdate) => void)[] = [];

  constructor() {
    this.context = this.initializeContext();
  }

  private initializeContext(): CityContext {
    return {
      districts: new Map(),
      agents: new Map(),
      transport: new Map(),
      state: {
        time: new Date(),
        weather: {
          condition: "clear",
          temperature: 20,
          humidity: 60,
        },
        population: 0,
        activeEvents: [],
        resourceUtilization: {
          power: 0.5,
          water: 0.4,
          transport: 0.6,
        },
        alerts: [],
      },
      metrics: {
        sustainability: 0.7,
        livability: 0.8,
        efficiency: 0.6,
        safety: 0.9,
      },
    };
  }

  updateMetric(metric: CityMetric, value: number) {
    this.context.metrics[metric] = Math.max(0, Math.min(1, value));
    this.notifyUpdate({
      type: "metric",
      data: { metric, value },
      timestamp: Date.now(),
      source: "cityContext",
    });
  }

  addDistrict(district: District) {
    this.context.districts.set(district.id, district);
    this.recalculateMetrics();
  }

  addAgent(agent: Agent) {
    this.context.agents.set(agent.id, agent);
  }

  addEvent(event: CityEvent) {
    this.context.state.activeEvents.push(event);
    this.notifyUpdate({
      type: "event",
      data: event,
      timestamp: Date.now(),
      source: "cityContext",
    });
    this.recalculateMetrics();
  }

  private recalculateMetrics() {
    // Calculate sustainability
    const sustainability = this.calculateSustainability();
    this.updateMetric("sustainability", sustainability);

    // Calculate livability
    const livability = this.calculateLivability();
    this.updateMetric("livability", livability);

    // Calculate efficiency
    const efficiency = this.calculateEfficiency();
    this.updateMetric("efficiency", efficiency);

    // Calculate safety
    const safety = this.calculateSafety();
    this.updateMetric("safety", safety);
  }

  private calculateSustainability(): number {
    // Implementation based on green spaces, energy usage, etc.
    return 0.7; // Placeholder
  }

  private calculateLivability(): number {
    // Implementation based on amenities, air quality, etc.
    return 0.8; // Placeholder
  }

  private calculateEfficiency(): number {
    // Implementation based on resource utilization, transport flow, etc.
    return 0.6; // Placeholder
  }

  private calculateSafety(): number {
    // Implementation based on emergency events, crime rates, etc.
    return 0.9; // Placeholder
  }

  onUpdate(callback: (update: CityUpdate) => void) {
    this.updateCallbacks.push(callback);
  }

  private notifyUpdate(update: CityUpdate) {
    this.updateCallbacks.forEach((callback) => callback(update));
  }

  getContext(): CityContext {
    return this.context;
  }
}
