export type TransportType = "bus" | "train" | "subway";

export interface TransportSchedule {
  weekday: string[];
  weekend: string[];
  holidays: string[];
}

export interface TransportHub {
  id: string;
  type: string;
  capacity: number;
  schedule: TransportSchedule;
  currentUtilization: number;
  status: "active" | "inactive" | "maintenance";
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

export type TransportMode =
  | "bus"
  | "subway"
  | "tram"
  | "bike"
  | "pedestrian"
  | "car";

export interface TransportRoute {
  id: string;
  mode: TransportMode;
  name: string;
  type: "bus" | "train" | "tram" | "metro";
  stops: TransportStop[];
  schedule: RouteSchedule;
  status: "active" | "delayed" | "suspended";
  capacity: {
    max: number;
    current: number;
  };
  metrics: {
    reliability: number;
    utilization: number;
    efficiency: number;
    satisfaction: number;
  };
}

export interface TransportStop {
  id: string;
  name: string;
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  type?: string;
  priority?: number;
  temporary?: boolean;
  duration?: number;
  routes: string[]; // route IDs
  facilities: ("shelter" | "seating" | "ticket_machine" | "accessibility")[];
  crowding: number; // 0-1
}

export interface RouteSchedule {
  weekday: TimeSlot[];
  weekend: TimeSlot[];
  frequency: number; // minutes between services
  lastUpdated: number;
}

export interface TimeSlot {
  start: number; // hours in 24h format
  end: number;
  frequency: number;
  capacity: number;
}

export interface RouteAdjustment {
  location: [number, number];
  priority: number;
  suggestedStops: {
    primaryStop: {
      name: string;
      coordinates: [number, number];
      type: string;
    };
    nearbyAttractions?: Array<{
      name: string;
      type: string;
      location: [number, number];
    }>;
  };
}

export interface TemporaryRouteAdjustment {
  routeId: string;
  adjustmentType: "major" | "minor";
  temporaryStops: Array<{
    name: string;
    coordinates: [number, number];
    type: string;
    duration: number;
  }>;
  timeWindow: {
    start: number;
    end: number;
  };
  priority: number;
}
