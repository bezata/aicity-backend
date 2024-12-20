import { TransportRoute } from "./transport.types";

declare module "../services/transport.service" {
  export interface TransportService {
    getRoutes(): Promise<Map<string, TransportRoute>>;
    adjustService(
      routeId: string,
      adjustment: Partial<TransportRoute>
    ): Promise<void>;
    adjustCapacity(intensity: number): Promise<void>;
  }
}
