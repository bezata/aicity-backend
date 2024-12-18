import { EventEmitter } from "events";
import type {
  WeatherState,
  CityMood,
  CityUpdate,
  CityContext,
} from "../types/city.types";
import { CityContextManager } from "../utils/city-context";

export class CityService extends EventEmitter {
  private contextManager: CityContextManager;
  private currentWeather: WeatherState;
  private cityMood: CityMood;

  constructor() {
    super();
    this.contextManager = new CityContextManager();
    this.currentWeather = this.initializeWeather();
    this.cityMood = this.initializeMood();
    this.setupEventHandlers();
  }

  private initializeWeather(): WeatherState {
    return {
      condition: "clear",
      temperature: 20,
      humidity: 60,
      windSpeed: 5,
      precipitation: 0,
      forecast: [
        {
          condition: "clear",
          temperature: 22,
          timestamp: Date.now() + 3600000, // +1 hour
        },
      ],
    };
  }

  private initializeMood(): CityMood {
    return {
      overall: 0.7,
      factors: {
        happiness: 0.7,
        stress: 0.3,
        energy: 0.6,
        community: 0.8,
      },
      trends: [
        {
          timestamp: Date.now(),
          value: 0.7,
        },
      ],
      dominantEmotion: "positive",
    };
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
    return this.currentWeather;
  }

  async getCityMood(): Promise<CityMood> {
    return this.cityMood;
  }

  async broadcastEvent(eventType: string, eventData: any) {
    this.emit("cityEvent", { type: eventType, data: eventData });
    return true;
  }

  async updateWeather(weather: Partial<WeatherState>) {
    this.currentWeather = { ...this.currentWeather, ...weather };
    this.emit("weatherUpdate", this.currentWeather);
  }

  async updateMood(moodFactors: Partial<CityMood["factors"]>) {
    this.cityMood.factors = { ...this.cityMood.factors, ...moodFactors };
    this.cityMood.overall =
      Object.values(this.cityMood.factors).reduce((a, b) => a + b, 0) / 4;
    this.cityMood.trends.push({
      timestamp: Date.now(),
      value: this.cityMood.overall,
    });
    this.cityMood.dominantEmotion =
      this.cityMood.overall > 0.6
        ? "positive"
        : this.cityMood.overall < 0.4
        ? "negative"
        : "neutral";
    this.emit("moodUpdate", this.cityMood);
  }
}
