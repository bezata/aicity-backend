export type TransportType = "bus" | "train" | "subway";

export interface TransportSchedule {
  frequency: number; // minutes
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface TransportHub {
  id: string;
  type: TransportType;
  capacity: number;
  schedule: TransportSchedule;
  currentUtilization: number;
  status: "active" | "maintenance" | "inactive";
  lastMaintenance: number;
}

export interface TransportEvent {
  type: "arrival" | "departure" | "delay" | "service_change";
  scheduleId: string;
  location: string;
  timestamp: number;
  details: {
    delay?: number;
    reason?: string;
    nextStop?: string;
    estimatedArrival?: number;
  };
}
