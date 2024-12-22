import { EventEmitter } from "events";
import type {
  WeatherState,
  CityMood,
  CityUpdate,
  CityContext,
} from "../types/city.types";
import { CityContextManager } from "../utils/city-context";
import { MetricsService } from "./metrics.service";

interface CityMetricsSnapshot {
  timestamp: number;
  weather: WeatherState;
  mood: CityMood;
  activityLevel: number;
  emergencyStatus: "normal" | "alert" | "crisis";
  lastUpdate: number;
}

export class CityService extends EventEmitter {
  private contextManager: CityContextManager;
  private currentWeather: WeatherState;
  private cityMood: CityMood;
  private metricsHistory: CityMetricsSnapshot[] = [];
  private emergencyStatus: "normal" | "alert" | "crisis" = "normal";
  private activityLevel: number = 0.5;

  constructor(private metricsService: MetricsService) {
    super();
    this.contextManager = new CityContextManager();
    this.currentWeather = this.initializeWeather();
    this.cityMood = this.initializeMood();
    this.setupEventHandlers();
    this.startMetricsTracking();
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

    // Listen for emergency events
    this.on("emergencyAlert", (status: "normal" | "alert" | "crisis") => {
      this.emergencyStatus = status;
      this.updateMetricsSnapshot();
    });

    // Listen for activity level changes
    this.on("activityLevelChanged", (level: number) => {
      this.activityLevel = level;
      this.updateMetricsSnapshot();
    });
  }

  private startMetricsTracking() {
    // Update metrics snapshot every 5 minutes
    setInterval(() => this.updateMetricsSnapshot(), 5 * 60 * 1000);
  }

  private async updateMetricsSnapshot() {
    const snapshot: CityMetricsSnapshot = {
      timestamp: Date.now(),
      weather: this.currentWeather,
      mood: this.cityMood,
      activityLevel: this.activityLevel,
      emergencyStatus: this.emergencyStatus,
      lastUpdate: Date.now(),
    };

    this.metricsHistory.push(snapshot);
    // Keep last 24 hours of snapshots (288 snapshots at 5-minute intervals)
    if (this.metricsHistory.length > 288) {
      this.metricsHistory.shift();
    }

    // Update central metrics service
    await this.metricsService.updateMetrics({
      sustainability: {
        airQualityIndex: this.currentWeather.condition === "clear" ? 150 : 100,
        waterQualityScore: 0.8,
        biodiversityIndex: 0.6,
        carbonEmissions: this.activityLevel * 20,
        renewableEnergyRatio: 0.3,
        greenSpaceIndex: 0.4,
      },
      social: {
        communityWellbeing: this.cityMood.factors.community,
        healthcareAccessScore: 0.75,
        educationQualityIndex: 0.8,
        culturalEngagement: 3.5,
        civicParticipation: this.cityMood.factors.energy,
      },
      safety: {
        crimeRate: this.emergencyStatus === "crisis" ? 4.2 : 2.1,
        emergencyResponseTime: this.emergencyStatus === "alert" ? 12 : 8.5,
        publicTrustIndex: this.cityMood.factors.happiness,
        disasterReadiness: this.emergencyStatus === "normal" ? 0.8 : 0.6,
      },
    });

    this.emit("metricsUpdated", snapshot);
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

  async getMetricsHistory(hours: number = 24): Promise<CityMetricsSnapshot[]> {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.metricsHistory.filter(
      (snapshot) => snapshot.timestamp >= cutoffTime
    );
  }

  async getEmergencyStatus(): Promise<"normal" | "alert" | "crisis"> {
    return this.emergencyStatus;
  }

  async getActivityLevel(): Promise<number> {
    return this.activityLevel;
  }

  async broadcastEvent(eventType: string, eventData: any) {
    this.emit("cityEvent", { type: eventType, data: eventData });
    return true;
  }

  async updateWeather(weather: Partial<WeatherState>) {
    this.currentWeather = { ...this.currentWeather, ...weather };
    this.emit("weatherUpdate", this.currentWeather);
    this.updateMetricsSnapshot();
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
    this.updateMetricsSnapshot();
  }

  async updateActivityLevel(level: number) {
    if (level < 0 || level > 1) {
      throw new Error("Activity level must be between 0 and 1");
    }
    this.activityLevel = level;
    this.emit("activityLevelChanged", level);
    this.updateMetricsSnapshot();
  }

  async setEmergencyStatus(status: "normal" | "alert" | "crisis") {
    this.emergencyStatus = status;
    this.emit("emergencyAlert", status);
    this.updateMetricsSnapshot();
  }
}
