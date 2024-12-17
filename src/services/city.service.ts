import { EventEmitter } from "events";
import type { WeatherState, CityMood, CityUpdate } from "../types/city.types";
import { CityContextManager } from "../utils/city-context";

export class CityService extends EventEmitter {
  private contextManager: CityContextManager;

  constructor() {
    super();
    this.contextManager = new CityContextManager();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.contextManager.onUpdate((update: CityUpdate) => {
      this.emit("cityUpdate", update);
    });
  }

  getContext(): CityContext {
    return this.contextManager.getContext();
  }

  async getCurrentWeather(): Promise<WeatherState> {
    return this.weather;
  }

  async getCityMood(): Promise<CityMood> {
    return this.mood;
  }

  async broadcastEvent(eventType: string, eventData: any) {
    this.emit("cityEvent", { type: eventType, data: eventData });
    return true;
  }
}
