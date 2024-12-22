import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { CitizenService } from "./citizen.service";
import { TransportService } from "./transport.service";
import { DepartmentService } from "./department.service";
import { WeatherImpact } from "../types/weather-impact.types";

interface ActivityPattern {
  hour: number;
  type: "transport" | "business" | "leisure" | "social";
  intensity: number; // 0-1
  locations: string[]; // district IDs
}

interface WeatherState {
  type: WeatherImpact["type"];
  severity: number;
  duration: number;
  affectedDistricts: string[];
  startTime: number;
}

interface ActivityForecast {
  hour: number;
  predictions: {
    type: "transport" | "business" | "leisure" | "social";
    intensity: number;
    confidence: number;
  }[];
}

export class CityRhythmService extends EventEmitter {
  private currentHour: number = 0;
  private activityPatterns: ActivityPattern[] = [];

  constructor(
    private vectorStore: VectorStoreService,
    private citizenService: CitizenService,
    private transportService: TransportService,
    private departmentService: DepartmentService
  ) {
    super();
    this.initializePatterns();
  }

  private initializePatterns() {
    this.activityPatterns = [
      { hour: 7, type: "transport", intensity: 0.7, locations: [] },
      { hour: 8, type: "business", intensity: 0.9, locations: [] },
      { hour: 12, type: "social", intensity: 0.6, locations: [] },
      { hour: 17, type: "transport", intensity: 0.8, locations: [] },
      { hour: 18, type: "leisure", intensity: 0.7, locations: [] },
      { hour: 20, type: "social", intensity: 0.5, locations: [] },
    ];
  }

  async getCurrentPatterns(): Promise<ActivityPattern[]> {
    return this.activityPatterns.filter((p) => p.hour === this.currentHour);
  }

  async addActivityPattern(pattern: ActivityPattern): Promise<void> {
    // Validate pattern
    if (pattern.hour < 0 || pattern.hour > 23) {
      throw new Error("Invalid hour. Must be between 0 and 23");
    }
    if (pattern.intensity < 0 || pattern.intensity > 1) {
      throw new Error("Invalid intensity. Must be between 0 and 1");
    }

    // Add or update pattern
    const existingIndex = this.activityPatterns.findIndex(
      (p) => p.hour === pattern.hour && p.type === pattern.type
    );

    if (existingIndex >= 0) {
      this.activityPatterns[existingIndex] = pattern;
    } else {
      this.activityPatterns.push(pattern);
    }

    // Store in vector DB for analysis
    await this.vectorStore.upsert({
      id: `pattern-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Activity pattern: ${pattern.type} at hour ${pattern.hour}`
      ),
      metadata: {
        type: "district",
        patternType: pattern.type,
        hour: pattern.hour,
        intensity: pattern.intensity,
        locations: pattern.locations,
        timestamp: Date.now(),
      },
    });

    this.emit("patternAdded", pattern);
  }

  async getActivityForecast(
    type?: "transport" | "business" | "leisure" | "social"
  ): Promise<ActivityForecast[]> {
    const forecasts: ActivityForecast[] = [];
    const nextHours = Array.from(
      { length: 24 },
      (_, i) => (this.currentHour + i) % 24
    );

    for (const hour of nextHours) {
      const patterns = this.activityPatterns.filter(
        (p) => p.hour === hour && (!type || p.type === type)
      );

      if (patterns.length > 0) {
        forecasts.push({
          hour,
          predictions: patterns.map((p) => ({
            type: p.type,
            intensity: p.intensity,
            confidence: this.calculateConfidence(p),
          })),
        });
      }
    }

    return forecasts;
  }

  private calculateConfidence(pattern: ActivityPattern): number {
    // Base confidence starts at 0.8
    let confidence = 0.8;

    // Adjust based on time proximity
    const hourDiff = Math.abs(pattern.hour - this.currentHour);
    confidence -= hourDiff * 0.02; // Decrease confidence by 2% for each hour in the future

    // Adjust based on pattern type
    switch (pattern.type) {
      case "transport":
        // Transport patterns are more predictable
        confidence += 0.1;
        break;
      case "business":
        // Business patterns are fairly predictable
        confidence += 0.05;
        break;
      case "social":
        // Social patterns are less predictable
        confidence -= 0.1;
        break;
      case "leisure":
        // Leisure patterns are moderately predictable
        confidence -= 0.05;
        break;
    }

    // Ensure confidence stays between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  async simulateDailyRoutines(hour: number) {
    this.currentHour = hour;
    const patterns = this.activityPatterns.filter((p) => p.hour === hour);

    for (const pattern of patterns) {
      await this.executeActivityPattern(pattern);
    }

    // Store city state in vector DB for analysis
    await this.vectorStore.upsert({
      id: `city-rhythm-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `City activity at hour ${hour}`
      ),
      metadata: {
        type: "district",
        hour,
        patterns: patterns.map((p) => p.type),
        timestamp: Date.now(),
      },
    });

    this.emit("rhythmUpdated", { hour, patterns });
  }

  private async executeActivityPattern(pattern: ActivityPattern) {
    switch (pattern.type) {
      case "transport":
        await this.increaseCitizenActivity("transport", pattern.intensity);
        break;
      case "business":
        await this.openBusinesses(pattern.intensity);
        break;
      case "leisure":
        await this.activateLeisureVenues(pattern.intensity);
        break;
      case "social":
        await this.schedulePublicEvents(pattern.intensity);
        break;
    }
  }

  private async increaseCitizenActivity(type: string, intensity: number) {
    await this.transportService.adjustCapacity(intensity);
    await this.citizenService.updateActivityLevels(type, intensity);
  }

  private async openBusinesses(intensity: number) {
    const departments = await this.departmentService.getAllDepartments();
    for (const dept of departments) {
      if (dept.type === "urban_planning") {
        await this.departmentService.addActivity(dept.id, {
          type: "business_hours",
          intensity,
          timestamp: Date.now(),
        });
      }
    }
  }

  private async activateLeisureVenues(intensity: number) {
    // Implementation
  }

  private async schedulePublicEvents(intensity: number) {
    // Implementation
  }

  async adjustForWeather(weather: WeatherState): Promise<void> {
    // Implementation
  }
}
