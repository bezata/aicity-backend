import { CityMood } from "../types/culture.types";
import { WeatherCondition } from "./weather.types";

declare module "../services/city-rhythm.service" {
  export interface CityRhythmService {
    getCurrentMood(): Promise<CityMood>;
    adjustForWeather(condition: WeatherCondition): Promise<void>;
  }
}
