import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { DistrictService } from "./district.service";
import { SmartInfrastructureService } from "./smart-infrastructure.service";
import { AnalyticsService } from "./analytics.service";
import {
  EnvironmentalAlert,
  EnvironmentalMetrics,
  SustainabilityProject,
  GreenInitiative,
  ResourceUsage,
  EmissionSource,
  WaterQualityData,
  AirQualityData,
  NoiseData,
  BiodiversityMetrics,
  EnvironmentalZone,
  SmartSensor,
  DistrictInfrastructure,
  SmartSystem,
  SystemMetrics,
  WaterQualityScore,
} from "../types/environment.types";

export class EnvironmentService extends EventEmitter {
  private activeAlerts = new Set<EnvironmentalAlert>();
  private districtMetrics = new Map<string, EnvironmentalMetrics>();
  private sustainabilityProjects = new Map<string, SustainabilityProject>();
  private greenInitiatives = new Map<string, GreenInitiative>();
  private resourceUsage = new Map<string, ResourceUsage>();
  private emissionSources = new Map<string, EmissionSource>();
  private environmentalZones = new Map<string, EnvironmentalZone>();
  private smartSensors = new Map<string, SmartSensor>();

  constructor(
    private vectorStore: VectorStoreService,
    private districtService: DistrictService,
    private smartInfrastructure: SmartInfrastructureService,
    private analyticsService: AnalyticsService
  ) {
    super();
    this.initializeService();
  }

  private initializeService() {
    this.initializeEnvironmentalMonitoring();

    // Track environmental alerts
    this.on("environmentalAlert", (alert) => {
      this.analyticsService.trackInteraction(
        { id: alert.districtId, type: "environment" } as any,
        {
          type: "alert",
          content: alert.description,
          sentiment: alert.severity > 0.7 ? 0.2 : 0.5,
          topics: ["environment", alert.type, "alert"],
        } as any
      );
    });

    // Track air quality changes
    this.on("airQualityChanged", (data) => {
      this.analyticsService.trackInteraction(
        { id: data.districtId, type: "environment" } as any,
        {
          type: "air_quality",
          content: `Air quality index: ${data.aqi}`,
          sentiment: data.aqi > 150 ? 0.3 : 0.8,
          topics: ["environment", "air_quality", "health"],
        } as any
      );
    });

    // Track sustainability metrics
    this.on("sustainabilityMetricsUpdated", (metrics) => {
      this.analyticsService.trackInteraction(
        { id: metrics.districtId, type: "environment" } as any,
        {
          type: "sustainability",
          content: `Sustainability score: ${metrics.score}`,
          sentiment: metrics.score,
          topics: ["environment", "sustainability", "metrics"],
        } as any
      );

      // Track overall environmental mood
      this.analyticsService.trackMood(metrics.score);
    });
  }

  private initializeEnvironmentalMonitoring() {
    setInterval(() => this.monitorEnvironmentalMetrics(), 1000 * 60 * 5); // Every 5 minutes
    setInterval(() => this.processEnvironmentalAlerts(), 1000 * 60 * 15); // Every 15 minutes
    setInterval(() => this.updateSustainabilityProjects(), 1000 * 60 * 30); // Every 30 minutes
    setInterval(() => this.trackResourceUsage(), 1000 * 60 * 10); // Every 10 minutes
    setInterval(() => this.monitorEmissions(), 1000 * 60 * 20); // Every 20 minutes
  }

  private async monitorEnvironmentalMetrics() {
    const districts = await this.districtService.getAllDistricts();

    for (const district of districts) {
      const metrics: EnvironmentalMetrics = {
        airQuality: await this.measureAirQuality(district.id),
        waterQuality: await this.measureWaterQuality(district.id),
        noiseLevel: await this.measureNoiseLevel(district.id),
        greenCoverage: await this.calculateGreenCoverage(district.id),
        biodiversity: await this.assessBiodiversity(district.id),
        emissions: await this.calculateEmissions(district.id),
        sustainability: await this.calculateSustainabilityScore(district.id),
        resourceEfficiency: await this.calculateResourceEfficiency(district.id),
        wasteManagement: await this.assessWasteManagement(district.id),
        energyUsage: await this.monitorEnergyUsage(district.id),
        water: {
          quality: (await this.measureWaterQuality(district.id)).score || 0.5,
          usage: await this.measureWaterUsage(district.id),
          conservation: await this.measureSystemValue(
            await this.smartInfrastructure.getDistrictInfrastructure(
              district.id
            ),
            "water"
          ),
        },
        greenSpace: {
          coverage: await this.calculateGreenCoverage(district.id),
          quality: await this.measureSystemValue(
            await this.smartInfrastructure.getDistrictInfrastructure(
              district.id
            ),
            "green"
          ),
          accessibility: 0.7, // Default value, can be updated with actual accessibility calculation
        },
      };

      this.districtMetrics.set(district.id, metrics);
      this.emit("metricsUpdated", { districtId: district.id, metrics });
    }
  }

  private async processEnvironmentalAlerts() {
    for (const [districtId, metrics] of this.districtMetrics.entries()) {
      // Check air quality alerts
      if (metrics.airQuality.aqi < 50) {
        this.createAlert({
          id: crypto.randomUUID(),
          type: "air",
          severity: metrics.airQuality.aqi < 30 ? "high" : "medium",
          location: {
            districtId,
            coordinates: [0, 0], // Default coordinates
          },
          timestamp: Date.now(),
          description: `Poor air quality detected in district ${districtId}`,
          metrics: { airQuality: metrics.airQuality },
        });
      }

      // Check water quality alerts
      if (metrics.waterQuality.ph < 6) {
        this.createAlert({
          id: crypto.randomUUID(),
          type: "water",
          severity: metrics.waterQuality.ph < 4 ? "high" : "medium",
          location: {
            districtId,
            coordinates: [0, 0], // Default coordinates
          },
          timestamp: Date.now(),
          description: `Water quality issues detected in district ${districtId}`,
          metrics: { waterQuality: metrics.waterQuality },
        });
      }

      // Check noise level alerts
      if (metrics.noiseLevel.decibels > 70) {
        this.createAlert({
          id: crypto.randomUUID(),
          type: "noise",
          severity: metrics.noiseLevel.decibels > 80 ? "high" : "medium",
          location: {
            districtId,
            coordinates: [0, 0], // Default coordinates
          },
          timestamp: Date.now(),
          description: `High noise levels detected in district ${districtId}`,
          metrics: { noiseLevel: metrics.noiseLevel },
        });
      }
    }
  }

  private async updateSustainabilityProjects() {
    for (const project of this.sustainabilityProjects.values()) {
      const progress = await this.calculateProjectProgress(project);
      const impact = await this.assessProjectImpact(project);

      // Store project data in vector store for analysis
      await this.vectorStore.upsert({
        id: `sustainability-${project.id}`,
        values: await this.vectorStore.createEmbedding(
          `Sustainability project ${project.type} with progress ${progress} and impact ${impact.overall}`
        ),
        metadata: {
          type: "district", // Changed from "sustainability_project" to match allowed types
          projectId: project.id,
          projectType: project.type,
          districtId: project.districtId,
          progress,
          impact: JSON.stringify(impact),
          timestamp: Date.now(),
        },
      });

      this.emit("projectUpdated", { projectId: project.id, progress, impact });
    }
  }

  private async trackResourceUsage() {
    const districts = await this.districtService.getAllDistricts();

    for (const district of districts) {
      const usage: ResourceUsage = {
        water: await this.measureWaterUsage(district.id),
        energy: await this.measureEnergyUsage(district.id),
        waste: await this.measureWasteGeneration(district.id),
        recycling: await this.measureRecyclingRate(district.id),
      };

      this.resourceUsage.set(district.id, usage);
      this.emit("resourceUsageUpdated", { districtId: district.id, usage });
    }
  }

  private async monitorEmissions() {
    const districts = await this.districtService.getAllDistricts();

    for (const district of districts) {
      const sources = await this.identifyEmissionSources(district.id);
      const totalEmissions = sources.reduce(
        (total, source) => total + source.amount,
        0
      );

      if (totalEmissions > 0.7) {
        this.createAlert({
          id: crypto.randomUUID(),
          type: "green",
          severity: totalEmissions > 0.9 ? "high" : "medium",
          location: {
            districtId: district.id,
            coordinates: [0, 0], // Default coordinates
          },
          timestamp: Date.now(),
          description: `High emission levels detected in district ${district.id}`,
          metrics: { emissions: totalEmissions },
        });
      }

      const emissionSource: EmissionSource = {
        id: district.id,
        type: "district",
        amount: totalEmissions,
        location: {
          districtId: district.id,
          coordinates: [0, 0], // Default coordinates
        },
      };

      this.emissionSources.set(district.id, emissionSource);

      this.emit("emissionsUpdated", {
        districtId: district.id,
        emissions: totalEmissions,
        sources,
      });
    }
  }

  private async measureSystemValue(
    infrastructure: any,
    systemType: SmartSystem["type"]
  ): Promise<number> {
    if (!infrastructure?.systems?.length) return 0.5;

    const systems = infrastructure.systems.filter(
      (s: SmartSystem) => s.type === systemType
    );
    if (!systems.length) return 0.5;

    const values = systems.map((s: SmartSystem) => {
      const metrics = s.metrics || {};
      if ("value" in metrics && typeof metrics.value === "number")
        return metrics.value;
      if ("efficiency" in metrics && typeof metrics.efficiency === "number")
        return metrics.efficiency;
      if ("consumption" in metrics && typeof metrics.consumption === "number")
        return 1 - metrics.consumption;
      if ("emissions" in metrics && typeof metrics.emissions === "number")
        return 1 - metrics.emissions;
      if ("generation" in metrics && typeof metrics.generation === "number")
        return metrics.generation;
      return 0.5;
    });

    return (
      values.reduce((acc: number, val: number) => acc + val, 0) / values.length
    );
  }

  private async measureAirQuality(districtId: string): Promise<AirQualityData> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const sensorValue = await this.measureSystemValue(infrastructure, "air");

    return {
      pm25: sensorValue * 500,
      pm10: sensorValue * 500,
      no2: sensorValue * 200,
      o3: sensorValue * 300,
      aqi: sensorValue * 500,
    };
  }

  private async measureWaterQuality(
    districtId: string
  ): Promise<WaterQualityData> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const sensorValue = await this.measureSystemValue(infrastructure, "water");

    return {
      ph: 7 + (sensorValue - 0.5) * 2,
      turbidity: sensorValue,
      dissolvedOxygen: (1 - sensorValue) * 10,
      conductivity: sensorValue * 1000,
      temperature: 20 + (sensorValue - 0.5) * 10,
    };
  }

  private async measureNoiseLevel(districtId: string): Promise<NoiseData> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const sensorValue = await this.measureSystemValue(infrastructure, "noise");

    return {
      decibels: sensorValue * 120,
      frequency: 1000 + sensorValue * 4000,
      duration: 60,
      peakTime: Date.now(),
      source: "environmental_sensor",
    };
  }

  private async calculateGreenCoverage(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    return await this.measureSystemValue(infrastructure, "green");
  }

  private async assessBiodiversity(
    districtId: string
  ): Promise<BiodiversityMetrics> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const biodiversityValue = await this.measureSystemValue(
      infrastructure,
      "green"
    );

    return {
      speciesCount: Math.floor(biodiversityValue * 200),
      habitatQuality: biodiversityValue,
      ecosystemHealth: biodiversityValue,
    };
  }

  private async calculateEmissions(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const powerEmissions = await this.measureSystemValue(
      infrastructure,
      "power"
    );
    const wasteEmissions = await this.measureSystemValue(
      infrastructure,
      "waste"
    );
    return (powerEmissions + wasteEmissions) / 2;
  }

  private async calculateSustainabilityScore(
    districtId: string
  ): Promise<number> {
    const metrics = this.districtMetrics.get(districtId);
    if (!metrics) return 0.5;

    const airQualityScore = metrics.airQuality.aqi / 500;
    const waterQualityScore = await this.calculateWaterQualityScore(
      metrics.waterQuality
    );
    const noiseLevelScore = metrics.noiseLevel.decibels <= 60 ? 1 : 0;

    return (
      airQualityScore * 0.2 +
      waterQualityScore * 0.2 +
      metrics.greenCoverage * 0.15 +
      (1 - metrics.emissions) * 0.15 +
      metrics.resourceEfficiency * 0.15 +
      metrics.wasteManagement * 0.15
    );
  }

  private async calculateWaterQualityScore(
    data: WaterQualityData
  ): Promise<number> {
    const score: WaterQualityScore = {
      phScore: data.ph >= 6 && data.ph <= 8 ? 1 : 0,
      turbidityScore: 1 - data.turbidity,
      oxygenScore: data.dissolvedOxygen / 10,
      conductivityScore: Math.min(1, 1000 / data.conductivity),
      temperatureScore:
        data.temperature >= 15 && data.temperature <= 25 ? 1 : 0,
      value: 0,
    };

    score.value =
      (score.phScore +
        score.turbidityScore +
        score.oxygenScore +
        score.conductivityScore +
        score.temperatureScore) /
      5;

    const result = { ...data, score: score.value };
    return result.score;
  }

  private async calculateResourceEfficiency(
    districtId: string
  ): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const powerEfficiency = await this.measureSystemValue(
      infrastructure,
      "power"
    );
    const waterEfficiency = await this.measureSystemValue(
      infrastructure,
      "water"
    );
    const wasteEfficiency = await this.measureSystemValue(
      infrastructure,
      "waste"
    );
    return (powerEfficiency + waterEfficiency + wasteEfficiency) / 3;
  }

  private async assessWasteManagement(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    return await this.measureSystemValue(infrastructure, "waste");
  }

  private async monitorEnergyUsage(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    return await this.measureSystemValue(infrastructure, "power");
  }

  private async measureWaterUsage(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const waterSystems = infrastructure.systems.filter(
      (s) => s.type === "water"
    );
    return (
      waterSystems.reduce((acc, s) => acc + (s.consumption || 0), 0) /
      Math.max(waterSystems.length, 1)
    );
  }

  private async measureEnergyUsage(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const energySystems = infrastructure.systems.filter(
      (s) => s.type === "power"
    );
    return (
      energySystems.reduce((acc, s) => acc + (s.consumption || 0), 0) /
      Math.max(energySystems.length, 1)
    );
  }

  private async measureWasteGeneration(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const wasteSystems = infrastructure.systems.filter(
      (s) => s.type === "waste"
    );
    return (
      wasteSystems.reduce((acc, s) => acc + (s.generation || 0), 0) /
      Math.max(wasteSystems.length, 1)
    );
  }

  private async measureRecyclingRate(districtId: string): Promise<number> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    const recyclingSystems = infrastructure.systems.filter(
      (s) => s.type === "recycling"
    );
    return (
      recyclingSystems.reduce((acc, s) => acc + (s.efficiency || 0), 0) /
      Math.max(recyclingSystems.length, 1)
    );
  }

  private async identifyEmissionSources(
    districtId: string
  ): Promise<EmissionSource[]> {
    const infrastructure =
      await this.smartInfrastructure.getDistrictInfrastructure(districtId);
    if (!infrastructure?.systems?.length) return [];

    return infrastructure.systems
      .filter((s) => {
        const metrics = s.metrics || {};
        return "emissions" in metrics && typeof metrics.emissions === "number";
      })
      .map((s) => {
        const metrics = s.metrics || {};
        return {
          id: s.id,
          type: s.type as EmissionSource["type"],
          amount: (metrics as any).emissions || 0,
          location: {
            districtId,
            coordinates: [0, 0],
          },
        };
      });
  }

  private async calculateProjectProgress(
    project: SustainabilityProject
  ): Promise<number> {
    const metrics = this.districtMetrics.get(project.districtId);
    if (!metrics) return 0;

    switch (project.type) {
      case "green_space":
        return metrics.greenCoverage;
      case "emissions_reduction":
        return 1 - metrics.emissions;
      case "water_conservation":
        return this.calculateWaterQuality(metrics.waterQuality);
      case "waste_management":
        return metrics.wasteManagement;
      default:
        return 0.5;
    }
  }

  private calculateWaterQuality(data: WaterQualityData): number {
    return (
      (data.ph + data.turbidity + data.dissolvedOxygen + data.conductivity) / 4
    );
  }

  private async assessProjectImpact(project: SustainabilityProject): Promise<{
    environmental: number;
    social: number;
    economic: number;
    overall: number;
  }> {
    const metrics = this.districtMetrics.get(project.districtId);
    if (!metrics)
      return { environmental: 0, social: 0, economic: 0, overall: 0 };

    const environmental = metrics.sustainability;
    const social = 0.7; // Placeholder for social impact calculation
    const economic = 0.6; // Placeholder for economic impact calculation

    return {
      environmental,
      social,
      economic,
      overall: (environmental + social + economic) / 3,
    };
  }

  // Public API methods
  getActiveAlerts(): Set<EnvironmentalAlert> {
    return this.activeAlerts;
  }

  async getEnvironmentalMetrics(
    districtId?: string
  ): Promise<EnvironmentalMetrics | Map<string, EnvironmentalMetrics>> {
    if (districtId) {
      const defaultMetrics: EnvironmentalMetrics = {
        airQuality: {
          pm25: 10,
          pm10: 20,
          no2: 40,
          o3: 30,
          aqi: 50,
        },
        waterQuality: {
          ph: 7,
          turbidity: 0.5,
          dissolvedOxygen: 8,
          conductivity: 500,
          temperature: 20,
        },
        noiseLevel: {
          decibels: 45,
          frequency: 1000,
          duration: 60,
          peakTime: Date.now(),
          source: "environmental_sensor",
        },
        greenCoverage: 0.4,
        biodiversity: {
          speciesCount: 100,
          habitatQuality: 0.6,
          ecosystemHealth: 0.7,
        },
        emissions: 0.5,
        sustainability: 0.6,
        resourceEfficiency: 0.7,
        wasteManagement: 0.6,
        energyUsage: 0.5,
        water: {
          quality: (await this.measureWaterQuality(districtId)).score || 0.5,
          usage: await this.measureWaterUsage(districtId),
          conservation: await this.measureSystemValue(
            await this.smartInfrastructure.getDistrictInfrastructure(
              districtId
            ),
            "water"
          ),
        },
        greenSpace: {
          coverage: await this.calculateGreenCoverage(districtId),
          quality: await this.measureSystemValue(
            await this.smartInfrastructure.getDistrictInfrastructure(
              districtId
            ),
            "green"
          ),
          accessibility: 0.7, // Default value, can be updated with actual accessibility calculation
        },
      };
      return this.districtMetrics.get(districtId) || defaultMetrics;
    }
    return this.districtMetrics;
  }

  async addSustainabilityProject(
    project: SustainabilityProject
  ): Promise<void> {
    this.sustainabilityProjects.set(project.id, project);
    this.emit("projectAdded", project);
  }

  async addGreenInitiative(initiative: GreenInitiative): Promise<void> {
    this.greenInitiatives.set(initiative.id, initiative);
    this.emit("initiativeAdded", initiative);
  }

  private createAlert(alert: EnvironmentalAlert): void {
    this.activeAlerts.add(alert);
    this.emit("alertCreated", alert);
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = Array.from(this.activeAlerts).find((a) => a.id === alertId);
    if (alert) {
      this.activeAlerts.delete(alert);
      this.emit("alertResolved", alert);
    }
  }

  async addEnvironmentalZone(zone: EnvironmentalZone): Promise<void> {
    this.environmentalZones.set(zone.id, zone);

    // Store zone data in vector store for analysis
    await this.vectorStore.upsert({
      id: `zone-${zone.id}`,
      values: await this.vectorStore.createEmbedding(
        `Environmental zone of type ${zone.type} in district ${zone.districtId}`
      ),
      metadata: {
        type: "district",
        zoneId: zone.id,
        zoneType: zone.type,
        districtId: zone.districtId,
        status: zone.status,
        timestamp: Date.now(),
      },
    });

    this.emit("zoneAdded", zone);
  }

  async addSmartSensor(sensor: SmartSensor): Promise<void> {
    this.smartSensors.set(sensor.id, sensor);

    // Store sensor data in vector store for analysis
    await this.vectorStore.upsert({
      id: `sensor-${sensor.id}`,
      values: await this.vectorStore.createEmbedding(
        `Environmental sensor of type ${sensor.type} in district ${sensor.location.districtId}`
      ),
      metadata: {
        type: "district",
        sensorId: sensor.id,
        sensorType: sensor.type,
        districtId: sensor.location.districtId,
        status: sensor.status,
        timestamp: Date.now(),
      },
    });

    this.emit("sensorAdded", sensor);
  }

  async getEnvironmentalZones(
    districtId?: string
  ): Promise<EnvironmentalZone[]> {
    const zones = Array.from(this.environmentalZones.values());
    return districtId
      ? zones.filter((z) => z.districtId === districtId)
      : zones;
  }

  async getSmartSensors(districtId?: string): Promise<SmartSensor[]> {
    const sensors = Array.from(this.smartSensors.values());
    return districtId
      ? sensors.filter((s) => s.location.districtId === districtId)
      : sensors;
  }

  async updateZoneStatus(
    zoneId: string,
    status: EnvironmentalZone["status"]
  ): Promise<void> {
    const zone = this.environmentalZones.get(zoneId);
    if (zone) {
      zone.status = status;
      this.environmentalZones.set(zoneId, zone);
      this.emit("zoneUpdated", zone);
    }
  }

  async updateSensorStatus(
    sensorId: string,
    status: SmartSensor["status"]
  ): Promise<void> {
    const sensor = this.smartSensors.get(sensorId);
    if (sensor) {
      sensor.status = status;
      this.smartSensors.set(sensorId, sensor);
      this.emit("sensorUpdated", sensor);
    }
  }

  async updateSensorValue(sensorId: string, value: number): Promise<void> {
    const sensor = this.smartSensors.get(sensorId);
    if (sensor) {
      sensor.value = value;
      sensor.lastUpdate = Date.now();
      this.smartSensors.set(sensorId, sensor);
      this.emit("sensorValueUpdated", sensor);
    }
  }

  private async monitorSensors() {
    for (const sensor of this.smartSensors.values()) {
      if (sensor.status === "active") {
        const value = await this.readSensorValue(sensor);
        await this.updateSensorValue(sensor.id, value);

        // Check for anomalies and create alerts if necessary
        await this.checkSensorAnomalies(sensor);
      }
    }
  }

  private async readSensorValue(sensor: SmartSensor): Promise<number> {
    // Simulate reading from actual sensor hardware
    // In a real implementation, this would interface with physical sensors
    const baseValue = 0.5;
    const noise = Math.random() * 0.2 - 0.1; // Random noise between -0.1 and 0.1
    return Math.max(0, Math.min(1, baseValue + noise));
  }

  private async checkSensorAnomalies(sensor: SmartSensor): Promise<void> {
    const threshold = this.getSensorThreshold(sensor.type);

    if (sensor.value > threshold.high || sensor.value < threshold.low) {
      this.createAlert({
        id: crypto.randomUUID(),
        type: this.getSensorAlertType(sensor.type),
        severity: sensor.value > threshold.critical ? "high" : "medium",
        location: sensor.location,
        timestamp: Date.now(),
        description: `Anomalous reading from ${sensor.type} sensor in district ${sensor.location.districtId}`,
        metrics: this.createAlertMetrics(sensor),
      });
    }
  }

  private getSensorThreshold(type: SmartSensor["type"]): {
    low: number;
    high: number;
    critical: number;
  } {
    switch (type) {
      case "air_quality":
        return { low: 0.3, high: 0.7, critical: 0.8 };
      case "water_quality":
        return { low: 0.4, high: 0.8, critical: 0.9 };
      case "noise":
        return { low: 0.2, high: 0.6, critical: 0.7 };
      case "emissions":
        return { low: 0.3, high: 0.7, critical: 0.8 };
    }
  }

  private getSensorAlertType(
    sensorType: SmartSensor["type"]
  ): EnvironmentalAlert["type"] {
    switch (sensorType) {
      case "air_quality":
        return "air";
      case "water_quality":
        return "water";
      case "noise":
        return "noise";
      case "emissions":
        return "green";
    }
  }

  private createAlertMetrics(
    sensor: SmartSensor
  ): Partial<EnvironmentalMetrics> {
    switch (sensor.type) {
      case "air_quality":
        return {
          airQuality: {
            pm25: sensor.value * 500,
            pm10: sensor.value * 500,
            no2: sensor.value * 200,
            o3: sensor.value * 300,
            aqi: sensor.value * 500,
          },
        };
      case "water_quality":
        return {
          waterQuality: {
            ph: 7 + (sensor.value - 0.5) * 2,
            turbidity: sensor.value,
            dissolvedOxygen: (1 - sensor.value) * 10,
            conductivity: sensor.value * 1000,
            temperature: 20 + (sensor.value - 0.5) * 10,
          },
        };
      case "noise":
        return {
          noiseLevel: {
            decibels: sensor.value * 120,
            frequency: 1000 + sensor.value * 4000,
            duration: 60,
            peakTime: Date.now(),
            source: "environmental_sensor",
          },
        };
      default:
        return {};
    }
  }
}
