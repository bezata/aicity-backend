import type { WeatherState, CityMood } from "../types/city.types";

export async function getCityContext(
  weather: WeatherState,
  mood: CityMood
): Promise<string> {
  return `Weather: ${weather.type} (${weather.temperature}°C), City Mood: ${mood.level} (${mood.intensity})`;
}
