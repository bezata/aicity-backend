export type TransportType = "bus" | "train" | "subway";

export interface TransportSchedule {
  id: string;
  type: TransportType;
  route: string[]; // district IDs
  schedule: {
    frequency: number; // minutes
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  };
  currentLocation?: string; // district ID
  passengers: string[]; // agent IDs
  status: "active" | "delayed" | "suspended";
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
