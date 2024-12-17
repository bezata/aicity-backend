import { District } from "./district.types";
import { Agent } from "./agent.types";
import { CityEvent } from "./city-events";
import { TransportSchedule } from "./transport.types";

export interface CityState {
  time: Date;
  weather: {
    condition: "clear" | "rain" | "cloudy" | "storm";
    temperature: number;
    humidity: number;
  };
  population: number;
  activeEvents: CityEvent[];
  resourceUtilization: {
    power: number;
    water: number;
    transport: number;
  };
  alerts: {
    level: "info" | "warning" | "emergency";
    message: string;
    timestamp: number;
  }[];
}

export interface CityContext {
  districts: Map<string, District>;
  agents: Map<string, Agent>;
  transport: Map<string, TransportSchedule>;
  state: CityState;
  metrics: {
    sustainability: number;
    livability: number;
    efficiency: number;
    safety: number;
  };
}

export type CityMetric = keyof CityContext["metrics"];

export interface CityUpdate {
  type: "state" | "metric" | "event" | "transport";
  data: any;
  timestamp: number;
  source: string;
}
