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

export interface SmartSystem {
  id: string;
  type:
    | "traffic"
    | "power"
    | "water"
    | "waste"
    | "transportation"
    | "digital"
    | "pedestrian";
  status: "active" | "maintenance" | "offline";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  metrics: {
    efficiency: number;
    reliability: number;
    utilization: number;
    connectivity: number;
    accessibility: number;
  };
  lastUpdate: number;
  nextMaintenance?: number;
  alerts: Array<{
    type: string;
    severity: number;
    message: string;
    timestamp: number;
  }>;
}
