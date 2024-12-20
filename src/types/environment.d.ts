import { EnvironmentalMetrics } from "./environment.types";

declare module "../services/environment.service" {
  export interface EnvironmentService {
    getDistrictMetrics(
      districtId: string
    ): Promise<Map<string, EnvironmentalMetrics>>;
  }
}
