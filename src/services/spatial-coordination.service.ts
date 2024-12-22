import { EventEmitter } from "events";
import { District } from "../types/district.types";
import { Agent } from "../types/agent.types";
import { VectorStoreService } from "./vector-store.service";
import { DistrictService } from "./district.service";
import { EmergencyService } from "./emergency.service";
import { EventBus } from "./event-bus.service";

interface Coordinates {
  x: number;
  y: number;
}

interface LocationNode {
  id: string;
  type:
    | "district_center"
    | "emergency_point"
    | "meeting_point"
    | "transport_hub"
    | "ai_hub"
    | "smart_intersection";
  coordinates: Coordinates;
  districtId: string;
  capacity: number;
  currentOccupancy: number;
  connections: string[];
  aiMetrics?: {
    processingPower: number;
    bandwidth: number;
    utilizationRate: number;
    efficiency: number;
  };
  smartFeatures?: {
    trafficControl: boolean;
    environmentalMonitoring: boolean;
    emergencyResponse: boolean;
    crowdManagement: boolean;
  };
}

interface MovementPlan {
  path: Coordinates[];
  estimatedTime: number;
  congestionLevel: number;
  alternativeRoutes: Coordinates[][];
  smartIntersections: string[];
}

export class SpatialCoordinationService extends EventEmitter {
  private locationNodes: Map<string, LocationNode> = new Map();
  private agentLocations: Map<string, Coordinates> = new Map();
  private readonly eventBus: EventBus;

  constructor(
    private vectorStore: VectorStoreService,
    private districtService: DistrictService,
    private emergencyService: EmergencyService
  ) {
    super();
    this.eventBus = EventBus.getInstance();
    this.initializeCoordinateSystem();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.eventBus.on("emergencyAlert", this.handleEmergency.bind(this));
    this.eventBus.on("congestionDetected", this.optimizeTraffic.bind(this));
    this.eventBus.on("aiSystemUpdate", this.updateAINodes.bind(this));
  }

  async moveAgent(
    agentId: string,
    targetLocation: Coordinates
  ): Promise<boolean> {
    const currentLocation = this.agentLocations.get(agentId);
    if (!currentLocation) return false;

    const movementPlan = await this.calculateMovementPlan(
      currentLocation,
      targetLocation
    );
    if (movementPlan.congestionLevel > 0.8) {
      await this.handleHighCongestion(movementPlan);
    }

    await this.executeAgentMovement(agentId, movementPlan);
    await this.recordMovement(agentId, currentLocation, targetLocation);

    return true;
  }

  private async calculateMovementPlan(
    start: Coordinates,
    end: Coordinates
  ): Promise<MovementPlan> {
    const path = await this.findOptimalPath(start, end);
    const smartIntersections = this.findSmartIntersectionsOnPath(path);
    const congestionLevel = await this.analyzeCongestion(path);
    const alternativeRoutes =
      congestionLevel > 0.6 ? await this.findAlternativeRoutes(start, end) : [];

    return {
      path,
      estimatedTime: this.calculateEstimatedTime(path, congestionLevel),
      congestionLevel,
      alternativeRoutes,
      smartIntersections,
    };
  }

  private async findOptimalPath(
    start: Coordinates,
    end: Coordinates
  ): Promise<Coordinates[]> {
    const nodes = Array.from(this.locationNodes.values());
    const graph = this.buildNavigationGraph(nodes);
    return this.aStarPathfinding(start, end, graph);
  }

  private async analyzeCongestion(path: Coordinates[]): Promise<number> {
    const agentDensity = await this.calculateAgentDensity(path);
    const trafficFlow = await this.analyzeTrafficFlow(path);
    return (agentDensity + trafficFlow) / 2;
  }

  private async handleHighCongestion(plan: MovementPlan) {
    const optimizedRoute = await this.optimizeRoute(plan);
    this.eventBus.emit("congestionHandled", {
      area: plan.path[0],
      congestionLevel: plan.congestionLevel,
      optimizedRoute,
    });
  }

  private async recordMovement(
    agentId: string,
    from: Coordinates,
    to: Coordinates
  ) {
    await this.vectorStore.upsert({
      id: `movement-${agentId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Agent ${agentId} movement from (${from.x},${from.y}) to (${to.x},${to.y})`
      ),
      metadata: {
        type: "transport",
        agentId,
        fromLocation: JSON.stringify(from),
        toLocation: JSON.stringify(to),
        timestamp: Date.now(),
      },
    });
  }

  async getClosestEmergencyPoint(
    coordinates: Coordinates
  ): Promise<LocationNode | null> {
    const emergencyNodes = Array.from(this.locationNodes.values()).filter(
      (node) => node.type === "emergency_point"
    );

    return this.findClosestNode(coordinates, emergencyNodes);
  }

  async findOptimalMeetingPoint(
    agents: string[]
  ): Promise<LocationNode | null> {
    const agentLocations = agents
      .map((id) => this.agentLocations.get(id))
      .filter((loc): loc is Coordinates => !!loc);

    if (agentLocations.length === 0) return null;

    const centroid = this.calculateCentroid(agentLocations);
    const meetingNodes = Array.from(this.locationNodes.values()).filter(
      (node) =>
        node.type === "meeting_point" &&
        node.currentOccupancy < node.capacity &&
        this.isNodeAvailable(node)
    );

    return this.findClosestNode(centroid, meetingNodes);
  }

  private async initializeCoordinateSystem() {
    const districts = await this.districtService.getAllDistricts();
    for (const district of districts) {
      await this.createDistrictNodes(district);
    }
    await this.connectNodes();
    await this.initializeAIHubs();
  }

  private async createDistrictNodes(district: District) {
    const center = this.calculateDistrictCenter(district.boundaries);

    // Create center node
    const centerNode: LocationNode = {
      id: `center-${district.id}`,
      type: "district_center",
      coordinates: center,
      districtId: district.id,
      capacity: 100,
      currentOccupancy: 0,
      connections: [],
      smartFeatures: {
        trafficControl: true,
        environmentalMonitoring: true,
        emergencyResponse: true,
        crowdManagement: true,
      },
    };

    // Create AI hub
    const aiHub: LocationNode = {
      id: `ai-hub-${district.id}`,
      type: "ai_hub",
      coordinates: {
        x: center.x + 0.05,
        y: center.y + 0.05,
      },
      districtId: district.id,
      capacity: 50,
      currentOccupancy: 0,
      connections: [centerNode.id],
      aiMetrics: {
        processingPower: 100,
        bandwidth: 1000,
        utilizationRate: 0,
        efficiency: 1,
      },
    };

    this.locationNodes.set(centerNode.id, centerNode);
    this.locationNodes.set(aiHub.id, aiHub);
  }

  private calculateDistrictCenter(boundaries: [number, number][]): Coordinates {
    const sumX = boundaries.reduce((sum, coord) => sum + coord[0], 0);
    const sumY = boundaries.reduce((sum, coord) => sum + coord[1], 0);
    return {
      x: sumX / boundaries.length,
      y: sumY / boundaries.length,
    };
  }

  private async handleEmergency(alert: any) {
    const nearbyNodes = this.findNodesInRadius(alert.location, 1.0);
    for (const node of nearbyNodes) {
      node.smartFeatures!.emergencyResponse = true;
      this.eventBus.emit("nodeStateChanged", {
        nodeId: node.id,
        type: "emergency_mode",
        active: true,
      });
    }
  }

  private async optimizeTraffic(congestionData: any) {
    const affectedArea = congestionData.area;
    const nodes = this.findNodesInRadius(affectedArea, 0.5);

    for (const node of nodes) {
      if (node.smartFeatures?.trafficControl) {
        await this.adjustTrafficControl(node, congestionData);
      }
    }
  }

  private async updateAINodes(update: any) {
    const aiHubs = Array.from(this.locationNodes.values()).filter(
      (node) => node.type === "ai_hub"
    );

    for (const hub of aiHubs) {
      hub.aiMetrics = {
        ...hub.aiMetrics!,
        utilizationRate: update.utilizationRate,
        efficiency: update.efficiency,
      };
    }
  }

  private findNodesInRadius(
    center: Coordinates,
    radius: number
  ): LocationNode[] {
    return Array.from(this.locationNodes.values()).filter(
      (node) => this.calculateDistance(center, node.coordinates) <= radius
    );
  }

  private async adjustTrafficControl(node: LocationNode, congestionData: any) {
    // Implementation for smart traffic control adjustment
    this.eventBus.emit("trafficControlAdjusted", {
      nodeId: node.id,
      adjustments: {
        signalTiming: congestionData.recommendedTiming,
        routeDiversion: congestionData.alternativeRoutes,
      },
    });
  }

  private isNodeAvailable(node: LocationNode): boolean {
    return (
      node.currentOccupancy < node.capacity * 0.8 &&
      (!node.aiMetrics || node.aiMetrics.utilizationRate < 0.9)
    );
  }

  private findClosestNode(
    point: Coordinates,
    nodes: LocationNode[]
  ): LocationNode | null {
    return nodes.reduce((closest, current) => {
      const currentDistance = this.calculateDistance(
        point,
        current.coordinates
      );
      const closestDistance = closest
        ? this.calculateDistance(point, closest.coordinates)
        : Infinity;
      return currentDistance < closestDistance ? current : closest;
    }, null as LocationNode | null);
  }

  private calculateDistance(point1: Coordinates, point2: Coordinates): number {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  }

  private calculateCentroid(points: Coordinates[]): Coordinates {
    const sum = points.reduce(
      (acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
      }),
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }

  private async executeAgentMovement(agentId: string, plan: MovementPlan) {
    for (const point of plan.path) {
      this.agentLocations.set(agentId, point);
      this.emit("agentMoved", {
        agentId,
        location: point,
        congestion: plan.congestionLevel,
        estimatedTimeRemaining: plan.estimatedTime,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private findSmartIntersectionsOnPath(path: Coordinates[]): string[] {
    return Array.from(this.locationNodes.values())
      .filter(
        (node) =>
          node.type === "smart_intersection" &&
          path.some(
            (point) => this.calculateDistance(point, node.coordinates) < 0.1
          )
      )
      .map((node) => node.id);
  }

  private async findAlternativeRoutes(
    start: Coordinates,
    end: Coordinates
  ): Promise<Coordinates[][]> {
    const mainPath = await this.findOptimalPath(start, end);
    const alternatives: Coordinates[][] = [];

    // Find alternative routes through different nodes
    const midPoints = Array.from(this.locationNodes.values()).filter(
      (node) =>
        node.type === "transport_hub" &&
        this.calculateDistance(node.coordinates, start) <
          this.calculateDistance(start, end)
    );

    for (const point of midPoints) {
      const route1 = await this.findOptimalPath(start, point.coordinates);
      const route2 = await this.findOptimalPath(point.coordinates, end);
      alternatives.push([...route1, ...route2]);
    }

    return alternatives;
  }

  private calculateEstimatedTime(
    path: Coordinates[],
    congestion: number
  ): number {
    const baseTime = path.reduce((time, point, index) => {
      if (index === 0) return 0;
      return time + this.calculateDistance(path[index - 1], point) * 100;
    }, 0);

    return baseTime * (1 + congestion);
  }

  private buildNavigationGraph(
    nodes: LocationNode[]
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    nodes.forEach((node) => {
      const connections = new Set<string>();
      nodes.forEach((other) => {
        if (
          node.id !== other.id &&
          this.calculateDistance(node.coordinates, other.coordinates) < 1.0
        ) {
          connections.add(other.id);
        }
      });
      graph.set(node.id, connections);
    });

    return graph;
  }

  private aStarPathfinding(
    start: Coordinates,
    end: Coordinates,
    graph: Map<string, Set<string>>
  ): Coordinates[] {
    // A* implementation
    return [start, end]; // Placeholder
  }

  private async calculateAgentDensity(path: Coordinates[]): Promise<number> {
    const nearbyAgents = Array.from(this.agentLocations.entries()).filter(
      ([_, location]) =>
        path.some((point) => this.calculateDistance(point, location) < 0.5)
    );

    return nearbyAgents.length / (path.length * 0.5);
  }

  private async analyzeTrafficFlow(path: Coordinates[]): Promise<number> {
    const trafficNodes = path
      .map((point) =>
        Array.from(this.locationNodes.values()).find(
          (node) =>
            node.type === "smart_intersection" &&
            this.calculateDistance(point, node.coordinates) < 0.1
        )
      )
      .filter((node): node is LocationNode => !!node);

    return (
      trafficNodes.reduce(
        (flow, node) => flow + node.currentOccupancy / node.capacity,
        0
      ) / Math.max(trafficNodes.length, 1)
    );
  }

  private async optimizeRoute(plan: MovementPlan): Promise<Coordinates[]> {
    if (plan.alternativeRoutes.length === 0) return plan.path;

    const routeScores = await Promise.all(
      plan.alternativeRoutes.map(async (route) => ({
        route,
        score: await this.calculateRouteScore(route),
      }))
    );

    const bestRoute = routeScores.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return bestRoute.route;
  }

  private async calculateRouteScore(route: Coordinates[]): Promise<number> {
    const distance = route.reduce((total, point, index) => {
      if (index === 0) return 0;
      return total + this.calculateDistance(route[index - 1], point);
    }, 0);

    const congestion = await this.analyzeCongestion(route);
    const smartIntersections = this.findSmartIntersectionsOnPath(route).length;

    return (1 / distance) * (1 - congestion) * (1 + smartIntersections * 0.1);
  }

  private async connectNodes() {
    const nodes = Array.from(this.locationNodes.values());
    for (const node of nodes) {
      const nearbyNodes = nodes.filter(
        (other) =>
          other.id !== node.id &&
          this.calculateDistance(node.coordinates, other.coordinates) < 1.0
      );
      node.connections = nearbyNodes.map((n) => n.id);
    }
  }

  private async initializeAIHubs() {
    const districts = await this.districtService.getAllDistricts();
    for (const district of districts) {
      const center = this.calculateDistrictCenter(district.boundaries);
      const aiHub: LocationNode = {
        id: `ai-hub-${district.id}`,
        type: "ai_hub",
        coordinates: {
          x: center.x + 0.05,
          y: center.y + 0.05,
        },
        districtId: district.id,
        capacity: 50,
        currentOccupancy: 0,
        connections: [],
        aiMetrics: {
          processingPower: 100,
          bandwidth: 1000,
          utilizationRate: 0,
          efficiency: 1,
        },
      };
      this.locationNodes.set(aiHub.id, aiHub);
    }
  }
}
