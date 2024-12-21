import { EventEmitter } from "events";
import { WeatherImpact } from "../types/weather-impact.types";
import { VectorStoreService } from "./vector-store.service";
import { CityService } from "./city.service";
import { TransportService } from "./transport.service";
import { CityRhythmService } from "./city-rhythm.service";
import { EmergencyType } from "../types/emergency.types";
import { EmergencyService } from "./emergency.service";

interface WeatherState {
  type: WeatherImpact["type"];
  severity: number; // 0-1
  duration: number; // hours
  affectedDistricts: string[];
  startTime: number;
}

export class WeatherService extends EventEmitter {
  private currentWeather: WeatherState | null = null;
  private weatherHistory: WeatherState[] = [];

  constructor(
    private vectorStore: VectorStoreService,
    private cityService: CityService,
    private transportService: TransportService | null,
    private cityRhythmService: CityRhythmService,
    private emergencyService: EmergencyService
  ) {
    super();
    this.initializeWeatherSystem();
  }

  private async initializeWeatherSystem() {
    // Start weather simulation cycle
    setInterval(() => this.simulateWeatherChanges(), 1000 * 60 * 60); // Every hour
  }

  private async simulateWeatherChanges() {
    if (Math.random() < 0.3) {
      // 30% chance of weather change
      const newWeather = this.generateWeatherCondition();
      await this.setWeatherCondition(newWeather);
    }
  }

  private generateWeatherCondition(): WeatherState {
    const types: WeatherImpact["type"][] = ["rain", "snow", "heat", "storm"];
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      type,
      severity: Math.random(),
      duration: Math.floor(Math.random() * 12) + 1, // 1-12 hours
      affectedDistricts: [], // To be filled based on city layout
      startTime: Date.now(),
    };
  }

  async setWeatherCondition(weather: WeatherState) {
    this.currentWeather = weather;
    this.weatherHistory.push(weather);

    // Store in vector DB for pattern analysis
    await this.vectorStore.upsert({
      id: `weather-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `${weather.type} weather condition with severity ${weather.severity}`
      ),
      metadata: {
        type: "district",
        weatherType: weather.type,
        severity: weather.severity,
        timestamp: weather.startTime,
      },
    });

    await this.applyWeatherImpacts(weather);
    this.emit("weatherChanged", weather);
  }

  private async applyWeatherImpacts(weather: WeatherState) {
    const impacts = this.calculateWeatherImpacts(weather);

    if (this.transportService) {
      await this.transportService.adjustEfficiency(impacts.transport);
    }

    // Check for weather-related emergencies
    if (weather.severity > 0.7) {
      await this.handleSevereWeather(weather);
    }

    // Adjust city rhythm
    await this.cityRhythmService.adjustForWeather(weather);
  }

  private calculateWeatherImpacts(
    weather: WeatherState
  ): WeatherImpact["affects"] {
    const baseImpacts: Record<WeatherImpact["type"], WeatherImpact["affects"]> =
      {
        rain: {
          transport: 0.8,
          mood: 0.7,
          energy: 1.1,
          activities: ["outdoor_events", "construction"],
        },
        snow: {
          transport: 0.5,
          mood: 0.6,
          energy: 1.3,
          activities: ["transport", "outdoor_work", "construction"],
        },
        heat: {
          transport: 0.9,
          mood: 0.6,
          energy: 1.4,
          activities: ["outdoor_events", "construction"],
        },
        storm: {
          transport: 0.4,
          mood: 0.5,
          energy: 1.2,
          activities: ["all_outdoor"],
        },
      };

    const impact = baseImpacts[weather.type];
    return {
      transport: impact.transport * (1 - weather.severity * 0.5),
      mood: impact.mood * (1 - weather.severity * 0.3),
      energy: impact.energy * (1 + weather.severity * 0.2),
      activities: impact.activities,
    };
  }

  private async handleSevereWeather(weather: WeatherState) {
    const emergencyType = this.determineEmergencyType(weather);
    if (emergencyType) {
      await this.emergencyService.handleEmergency({
        id: `weather-emergency-${Date.now()}`,
        type: emergencyType,
        priority: weather.severity > 0.9 ? "critical" : "high",
        location: {
          districtId: weather.affectedDistricts[0],
          coordinates: [0, 0], // To be determined based on district
        },
        description: `Severe ${weather.type} causing emergency conditions`,
        affectedArea: {
          radius: 5000, // 5km
          districtIds: weather.affectedDistricts,
        },
        status: "reported",
        timestamp: Date.now(),
        responseUnits: [],
      });
    }
  }

  private determineEmergencyType(weather: WeatherState): EmergencyType | null {
    if (weather.severity < 0.7) return null;

    switch (weather.type) {
      case "storm":
        return EmergencyType.DISASTER;
      case "snow":
        return EmergencyType.INFRASTRUCTURE;
      case "heat":
        return EmergencyType.ENVIRONMENTAL;
      default:
        return weather.severity > 0.9 ? EmergencyType.DISASTER : null;
    }
  }

  getCurrentWeather(): WeatherState | null {
    return this.currentWeather;
  }

  getWeatherHistory(hours: number = 24): WeatherState[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.weatherHistory.filter((w) => w.startTime >= cutoff);
  }
}
