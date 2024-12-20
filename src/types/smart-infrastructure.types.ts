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
  type: "traffic" | "power" | "water" | "waste";
  sensors: Array<{
    id: string;
    location: string;
    readings: number[];
    status: "active" | "maintenance" | "error";
  }>;
  automationRules: AutomationRule[];
}
