export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm";

export interface WeatherState {
  condition: WeatherCondition;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  forecast: {
    condition: WeatherCondition;
    temperature: number;
    timestamp: number;
  }[];
}

export interface WeatherImpact {
  type: WeatherCondition;
  affects: {
    transport: number; // Efficiency reduction
    mood: number; // Citizen satisfaction impact
    energy: number; // Power consumption change
    activities: string[]; // Affected outdoor activities
  };
}
