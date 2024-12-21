export interface AirQualityData {
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  aqi: number;
}

export interface WaterQualityData {
  ph: number;
  turbidity: number;
  dissolvedOxygen: number;
  conductivity: number;
  temperature: number;
  score?: number;
}

export interface NoiseData {
  decibels: number;
  frequency: number;
  duration: number;
  peakTime: number;
  source: string;
}

export interface BiodiversityMetrics {
  speciesCount: number;
  habitatQuality: number;
  ecosystemHealth: number;
}

export interface EnvironmentalMetrics {
  airQuality: AirQualityData;
  waterQuality: WaterQualityData;
  noiseLevel: NoiseData;
  greenCoverage: number;
  biodiversity: BiodiversityMetrics;
  emissions: number;
  sustainability: number;
  resourceEfficiency: number;
  wasteManagement: number;
  energyUsage: number;
}

export interface EmissionSource {
  id: string;
  type: string;
  amount: number;
  location: {
    districtId: string;
    coordinates: [number, number];
  };
}

export interface ResourceUsage {
  water: number;
  energy: number;
  waste: number;
  recycling: number;
}

export interface SustainabilityProject {
  id: string;
  type:
    | "green_space"
    | "emissions_reduction"
    | "water_conservation"
    | "waste_management";
  districtId: string;
  status: "planned" | "in_progress" | "completed";
  timeline: {
    start: number;
    end: number;
  };
  metrics: {
    progress: number;
    impact: {
      environmental: number;
      social: number;
      economic: number;
    };
  };
}

export interface GreenInitiative {
  id: string;
  name: string;
  description: string;
  districtId: string;
  type: "tree_planting" | "urban_farming" | "renewable_energy" | "recycling";
  status: "proposed" | "active" | "completed";
  participants: string[];
  metrics: {
    participation: number;
    environmentalImpact: number;
    communityEngagement: number;
  };
}

export interface EnvironmentalAlert {
  id: string;
  type: "air" | "water" | "noise" | "waste" | "green";
  severity: "low" | "medium" | "high";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  timestamp: number;
  description: string;
  metrics: Partial<EnvironmentalMetrics>;
}

export interface SmartSensor {
  id: string;
  type: "air_quality" | "water_quality" | "noise" | "emissions";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  value: number;
  lastUpdate: number;
  status: "active" | "maintenance" | "offline";
}

export interface EnvironmentalZone {
  id: string;
  type: "protection" | "conservation" | "development";
  districtId: string;
  boundaries: [number, number][];
  restrictions: {
    maxEmissions: number;
    noiseLimit: number;
    greenSpaceRatio: number;
  };
  status: "active" | "proposed" | "under_review";
}

export interface SmartSystem {
  id: string;
  type:
    | "water"
    | "waste"
    | "power"
    | "traffic"
    | "transportation"
    | "digital"
    | "pedestrian"
    | "air"
    | "noise"
    | "green"
    | "recycling";
  status: "active" | "maintenance" | "offline";
  metrics?: Partial<SystemMetrics>;
  location: {
    districtId: string;
    coordinates: [number, number];
  };
}

export interface DistrictInfrastructure {
  id: string;
  districtId: string;
  systems: SmartSystem[];
  status: "operational" | "degraded" | "offline";
  lastUpdate: number;
}

export interface SystemMetrics {
  value: number;
  efficiency: number;
  consumption: number;
  emissions: number;
  generation: number;
}

export interface WaterQualityScore {
  value: number;
  phScore: number;
  turbidityScore: number;
  oxygenScore: number;
  conductivityScore: number;
  temperatureScore: number;
}
