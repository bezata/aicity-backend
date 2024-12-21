export interface Community {
  id: string;
  name: string;
  members: string[];
  interests: string[];
  activityLevel: number;
  location: {
    districtId: string;
    coordinates: [number, number];
  };
}

export interface BridgePoint {
  id: string;
  type: "cultural" | "social" | "economic";
  communities: string[];
  strength: number;
  activities: string[];
}

export interface IsolatedGroup {
  id: string;
  type: "demographic" | "geographic" | "cultural";
  population: number;
  barriers: string[];
  potentialBridges: string[];
}

export interface ResourceNode {
  id: string;
  type: "water" | "power" | "data" | "supplies";
  capacity: number;
  currentLoad: number;
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  status: "active" | "maintenance" | "overloaded";
}

export interface DistributionNetwork {
  nodes: Map<string, ResourceNode>;
  connections: Connection[];
  efficiency: number;
  lastOptimized: number;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: "primary" | "secondary" | "emergency";
  capacity: number;
  currentLoad: number;
}
