export interface EnvironmentalMetrics {
  airQuality: {
    pm25: number; // 0-500
    pm10: number; // 0-500
    no2: number; // 0-200
    o3: number; // 0-300
    aqi: number; // 0-500 (Air Quality Index)
  };
  noise: {
    level: number; // decibels (0-120)
    sources: string[];
    peakHours: number[];
  };
  greenSpace: {
    coverage: number; // percentage (0-100)
    health: number; // 0-1
    usage: number; // 0-1
    biodiversity: number; // 0-1
  };
  water: {
    quality: number; // 0-1
    consumption: number; // liters per capita
    recycling: number; // percentage (0-100)
  };
  waste: {
    recycling: number; // percentage (0-100)
    collection: {
      efficiency: number; // 0-1
      schedule: string[];
    };
    hotspots: string[]; // district IDs
  };
}

export interface EnvironmentalAlert {
  id: string;
  type: "air" | "noise" | "water" | "waste" | "green";
  severity: "low" | "medium" | "high" | "critical";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  metrics: Partial<EnvironmentalMetrics>;
  timestamp: number;
  status: "active" | "resolved";
  actions: string[];
}
