export type WeatherType = "sunny" | "rainy" | "cloudy" | "stormy";
export type MoodLevel = "positive" | "neutral" | "negative";

export interface WeatherState {
  type: WeatherType;
  temperature: number;
}

export interface CityMood {
  level: MoodLevel;
  intensity: number;
}
