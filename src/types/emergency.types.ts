export enum EmergencyType {
  MEDICAL = "medical",
  FIRE = "fire",
  POLICE = "police",
  DISASTER = "disaster",
  INFRASTRUCTURE = "infrastructure",
  ENVIRONMENTAL = "environmental",
  WEATHER = "weather",
  ACCIDENT = "accident",
  SECURITY = "security",
  HEALTH = "health",
}

export interface Emergency {
  id: string;
  type: EmergencyType;
  priority: "low" | "medium" | "high" | "critical";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  description: string;
  affectedArea: {
    radius: number; // meters
    districtIds: string[];
  };
  status: "reported" | "responding" | "contained" | "resolved";
  timestamp: number;
  responseUnits: EmergencyUnit[];
}

export interface EmergencyUnit {
  id: string;
  type: EmergencyType;
  status: "available" | "responding" | "busy" | "maintenance";
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  capabilities: string[];
  personnel: number;
  estimatedResponseTime?: number;
}
