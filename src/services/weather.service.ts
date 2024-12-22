import { EventEmitter } from "events";
import { WeatherImpact } from "../types/weather-impact.types";
import { VectorStoreService } from "./vector-store.service";
import { CityService } from "./city.service";
import { TransportService } from "./transport.service";
import { CityRhythmService } from "./city-rhythm.service";
import { EmergencyType } from "../types/emergency.types";
import { EmergencyService } from "./emergency.service";
import { EventBus } from "./event-bus.service";
import { District } from "../types/district.types";

interface WeatherState {
  type: WeatherImpact["type"];
  severity: number;
  duration: number;
  affectedDistricts: string[];
  startTime: number;
  aiPredictions?: {
    nextChange: number;
    confidence: number;
    potentialImpacts: string[];
  };
  environmentalMetrics?: {
    airQuality: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    visibility: number;
  };
}

interface WeatherPrediction {
  type: WeatherImpact["type"];
  probability: number;
  estimatedSeverity: number;
  estimatedDuration: number;
  confidence: number;
  potentialImpacts: string[];
}

export class WeatherService extends EventEmitter {
  private currentWeather: WeatherState | null = null;
  private weatherHistory: WeatherState[] = [];
  private readonly eventBus: EventBus;
  private weatherPredictions: WeatherPrediction[] = [];

  constructor(
    private vectorStore: VectorStoreService,
    private cityService: CityService,
    private transportService: TransportService | null,
    private cityRhythmService: CityRhythmService,
    private emergencyService: EmergencyService
  ) {
    super();
    this.eventBus = EventBus.getInstance();
    this.initializeWeatherSystem();
  }

  private async initializeWeatherSystem() {
    setInterval(() => this.simulateWeatherChanges(), 1000 * 60 * 60); // Every hour
    setInterval(() => this.updateWeatherPredictions(), 1000 * 60 * 30); // Every 30 minutes
    setInterval(() => this.monitorEnvironmentalMetrics(), 1000 * 60 * 15); // Every 15 minutes
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.eventBus.on("aiPredictionUpdate", this.handleAIPrediction.bind(this));
    this.eventBus.on(
      "environmentalAlert",
      this.handleEnvironmentalAlert.bind(this)
    );
    this.eventBus.on("emergencyResponse", this.adjustForEmergency.bind(this));
  }

  private async updateWeatherPredictions() {
    const predictions = await this.generateWeatherPredictions();
    this.weatherPredictions = predictions;

    const highRiskPredictions = predictions.filter(
      (p) => p.probability > 0.7 && p.estimatedSeverity > 0.6
    );

    if (highRiskPredictions.length > 0) {
      this.eventBus.emit("weatherWarning", {
        predictions: highRiskPredictions,
        timestamp: Date.now(),
      });
    }
  }

  private async generateWeatherPredictions(): Promise<WeatherPrediction[]> {
    const recentHistory = this.getWeatherHistory(72); // Last 72 hours
    const embedding = await this.vectorStore.createEmbedding(
      JSON.stringify(
        recentHistory.map((w) => ({
          type: w.type,
          severity: w.severity,
          duration: w.duration,
        }))
      )
    );

    const similarPatterns = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "district" },
        weatherType: { $exists: true },
      },
      topK: 5,
    });

    return this.analyzePatternsForPredictions(similarPatterns.matches || []);
  }

  private analyzePatternsForPredictions(patterns: any[]): WeatherPrediction[] {
    return patterns.map((pattern) => ({
      type: pattern.metadata.weatherType,
      probability: pattern.score || 0.5,
      estimatedSeverity: pattern.metadata.severity || 0.5,
      estimatedDuration: pattern.metadata.duration || 6,
      confidence: pattern.score || 0.5,
      potentialImpacts: this.predictPotentialImpacts(pattern.metadata),
    }));
  }

  private predictPotentialImpacts(metadata: any): string[] {
    const impacts: string[] = [];
    if (metadata.severity > 0.7) {
      impacts.push("transport");
      impacts.push("outdoor_activities");
    }
    if (metadata.severity > 0.8) {
      impacts.push("power");
      impacts.push("infrastructure");
    }
    return impacts;
  }

  private async monitorEnvironmentalMetrics() {
    if (!this.currentWeather) return;

    const metrics = await this.measureEnvironmentalMetrics();
    this.currentWeather.environmentalMetrics = metrics;

    if (this.detectAnomalies(metrics)) {
      this.eventBus.emit("environmentalAnomaly", {
        metrics,
        weather: this.currentWeather,
        timestamp: Date.now(),
      });
    }
  }

  private async measureEnvironmentalMetrics() {
    // Simulated environmental measurements
    return {
      airQuality: Math.random() * 100,
      humidity: Math.random() * 100,
      pressure: 980 + Math.random() * 40,
      windSpeed: Math.random() * 30,
      visibility: Math.random() * 10,
    };
  }

  private detectAnomalies(
    metrics: WeatherState["environmentalMetrics"]
  ): boolean {
    if (!metrics) return false;

    return (
      metrics.airQuality < 50 ||
      metrics.windSpeed > 25 ||
      metrics.visibility < 3
    );
  }

  private async handleAIPrediction(prediction: any) {
    if (this.currentWeather) {
      this.currentWeather.aiPredictions = {
        nextChange: prediction.nextChange,
        confidence: prediction.confidence,
        potentialImpacts: prediction.impacts,
      };

      if (prediction.confidence > 0.8 && prediction.severity > 0.7) {
        await this.prepareForWeatherChange(prediction);
      }
    }
  }

  private async prepareForWeatherChange(prediction: any) {
    // Notify relevant services
    this.eventBus.emit("weatherPreparation", {
      prediction,
      recommendedActions: this.generatePreparationActions(prediction),
    });
  }

  private generatePreparationActions(prediction: any) {
    const actions = [];
    if (prediction.severity > 0.8) {
      actions.push("ALERT_EMERGENCY_SERVICES");
      actions.push("PREPARE_SHELTER_LOCATIONS");
    }
    if (prediction.impacts.includes("transport")) {
      actions.push("ADJUST_TRANSPORT_SCHEDULES");
    }
    if (prediction.impacts.includes("power")) {
      actions.push("ACTIVATE_BACKUP_SYSTEMS");
    }
    return actions;
  }

  private async handleEnvironmentalAlert(alert: any) {
    const weatherImpact = this.assessEnvironmentalImpact(alert);
    if (weatherImpact.severity > 0.5) {
      await this.adjustWeatherResponse(weatherImpact);
    }
  }

  private async adjustForEmergency(emergency: any) {
    if (this.currentWeather && emergency.type === EmergencyType.ENVIRONMENTAL) {
      const adjustedWeather = {
        ...this.currentWeather,
        severity: Math.max(this.currentWeather.severity, 0.8),
      };
      await this.setWeatherCondition(adjustedWeather);
    }
  }

  private async simulateWeatherChanges() {
    if (Math.random() < 0.3) {
      const newWeather = await this.generateWeatherCondition();
      await this.setWeatherCondition(newWeather);
    }
  }

  private async generateWeatherCondition(): Promise<WeatherState> {
    const types: WeatherImpact["type"][] = ["rain", "snow", "heat", "storm"];
    const type = types[Math.floor(Math.random() * types.length)];
    const severity = Math.random();
    const duration = Math.floor(Math.random() * 12) + 1;

    const districtsContext = this.cityService.getContext();
    const districts = Array.from(districtsContext.districts.values());
    const affectedDistricts = districts
      .filter((district: District) => Math.random() > 0.5)
      .map((district: District) => district.id);

    return {
      type,
      severity,
      duration,
      affectedDistricts,
      startTime: Date.now(),
      environmentalMetrics: await this.measureEnvironmentalMetrics(),
    };
  }

  async setWeatherCondition(weather: WeatherState) {
    this.currentWeather = weather;
    this.weatherHistory.push(weather);

    await this.storeWeatherData(weather);
    await this.applyWeatherImpacts(weather);

    this.eventBus.emit("weatherChanged", {
      ...weather,
      predictions: this.weatherPredictions,
      recommendations: this.generatePreparationActions(weather),
    });
  }

  private async storeWeatherData(weather: WeatherState) {
    const { environmentalMetrics, ...weatherData } = weather;

    await this.vectorStore.upsert({
      id: `weather-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `${weather.type} weather with severity ${weather.severity}`
      ),
      metadata: {
        type: "district",
        weatherType: weather.type,
        severity: weather.severity,
        duration: weather.duration,
        timestamp: weather.startTime,
        airQuality: environmentalMetrics?.airQuality,
        windSpeed: environmentalMetrics?.windSpeed,
        visibility: environmentalMetrics?.visibility,
      },
    });
  }

  private async applyWeatherImpacts(weather: WeatherState) {
    const impacts = this.calculateWeatherImpacts(weather);

    if (this.transportService) {
      await this.transportService.adjustEfficiency(impacts.transport);
    }

    await this.cityRhythmService.adjustForWeather(weather);

    if (weather.severity > 0.7) {
      await this.handleSevereWeather(weather);
    }
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
    const environmentalFactor = this.calculateEnvironmentalFactor(
      weather.environmentalMetrics
    );

    return {
      transport:
        impact.transport * (1 - weather.severity * 0.5) * environmentalFactor,
      mood: impact.mood * (1 - weather.severity * 0.3) * environmentalFactor,
      energy: impact.energy * (1 + weather.severity * 0.2),
      activities: impact.activities,
    };
  }

  private calculateEnvironmentalFactor(
    metrics?: WeatherState["environmentalMetrics"]
  ): number {
    if (!metrics) return 1;

    const visibilityImpact = metrics.visibility / 10;
    const windImpact = Math.max(0, 1 - metrics.windSpeed / 30);
    const airQualityImpact = metrics.airQuality / 100;

    return (visibilityImpact + windImpact + airQualityImpact) / 3;
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
          coordinates: await this.getDistrictCoordinates(
            weather.affectedDistricts[0]
          ),
        },
        description: `Severe ${weather.type} causing emergency conditions`,
        affectedArea: {
          radius: 5000,
          districtIds: weather.affectedDistricts,
        },
        status: "reported",
        timestamp: Date.now(),
        responseUnits: [],
      });
    }
  }

  private async getDistrictCoordinates(
    districtId: string
  ): Promise<[number, number]> {
    const districtsContext = this.cityService.getContext();
    const district = Array.from(districtsContext.districts.values()).find(
      (d: District) => d.id === districtId
    );
    if (!district || !district.boundaries || district.boundaries.length === 0) {
      return [0, 0]; // Default coordinates if district not found or no boundaries
    }

    // Calculate centroid from boundaries
    const sumLat = district.boundaries.reduce(
      (sum, coord) => sum + coord[0],
      0
    );
    const sumLng = district.boundaries.reduce(
      (sum, coord) => sum + coord[1],
      0
    );
    return [
      sumLat / district.boundaries.length,
      sumLng / district.boundaries.length,
    ];
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

  getWeatherPredictions(): WeatherPrediction[] {
    return this.weatherPredictions;
  }

  private assessEnvironmentalImpact(alert: any) {
    return {
      severity: alert.severity || 0,
      type: alert.type as WeatherImpact["type"],
      duration: alert.estimatedDuration || 1,
    };
  }

  private async adjustWeatherResponse(impact: any) {
    if (this.currentWeather) {
      const adjustedWeather = {
        ...this.currentWeather,
        severity: Math.max(this.currentWeather.severity, impact.severity),
        environmentalMetrics: await this.measureEnvironmentalMetrics(),
      };
      await this.setWeatherCondition(adjustedWeather);
    }
  }
}
