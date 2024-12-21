import { CityContext, CityMetric, CityUpdate } from "../types/city.types";
import { District } from "../types/district.types";
import { Agent } from "../types/agent.types";
import { CityEvent } from "../types/city-events";

export class CityContextManager {
  private context: CityContext;
  private updateCallbacks: ((update: CityUpdate) => void)[] = [];

  constructor(initialContext?: Partial<CityContext>) {
    this.context = {
      ...this.getDefaultContext(),
      ...initialContext,
    };
  }

  private getDefaultContext(): CityContext {
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

  updateContext(update: Partial<CityContext>) {
    this.context = {
      ...this.context,
      ...update,
      state: {
        ...this.context.state,
        ...update.state,
      },
      metrics: {
        ...this.context.metrics,
        ...update.metrics,
      },
    };
    this.notifyUpdate({
      type: "state",
      data: this.context,
      timestamp: Date.now(),
      source: "cityContext",
    });
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
