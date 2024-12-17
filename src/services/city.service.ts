import { EventEmitter } from "events";
import type { WeatherState, CityMood } from "../types/city.types";

export class CityService extends EventEmitter {
  private weather: WeatherState = { type: "sunny", temperature: 22 };
  private mood: CityMood = { level: "neutral", intensity: 0.5 };

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
