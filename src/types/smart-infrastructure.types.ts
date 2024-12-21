export interface AutomationRule {
  id: string;
  condition: {
    type: string;
    threshold: number;
    operator: ">" | "<" | "==" | ">=" | "<=";
  };
  action: {
    type: string;
    parameters: Record<string, any>;
  };
  priority: number;
  enabled: boolean;
}

export interface SmartDevice {
  id: string;
  type: string;
  status: "active" | "inactive" | "maintenance";
  automationRules: AutomationRule[];
  // ... rest of the interface
}

export type SystemType =
  | "traffic"
  | "power"
  | "water"
  | "waste"
  | "transportation"
  | "digital"
  | "pedestrian"
  | "recycling";

export interface SmartSystem {
  id: string;
  type: SystemType;
  status: "active" | "inactive" | "maintenance";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  metrics: {
    utilization: number;
    efficiency: number;
    connectivity?: number;
    accessibility?: number;
  };
  consumption?: number;
  generation?: number;
  efficiency?: number;
}

export interface WaterQualityMetrics {
  ph: number;
  turbidity: number;
  dissolvedOxygen: number;
  conductivity: number;
  temperature: number;
}

export interface DistrictInfrastructure {
  id?: string;
  districtId?: string;
  systems: SmartSystem[];
  status?: "operational" | "degraded" | "offline";
  lastUpdate?: number;
  resources: {
    water: {
      consumption: number;
      capacity: number;
    };
    power: {
      consumption: number;
      capacity: number;
    };
    data: {
      usage: number;
      capacity: number;
    };
  };
}

export interface Connection {
  sourceId: string;
  destinationCoordinates: [number, number];
  capacity: number;
  load: number;
  status: "active" | "inactive" | "maintenance";
  priority: number;
}
