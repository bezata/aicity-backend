import { EventEmitter } from "events";
import { District } from "../types/district.types";
import { Agent } from "../types/agent.types";
import { VectorStoreService } from "./vector-store.service";
import { DistrictService } from "./district.service";
import { EmergencyService } from "./emergency.service";
import { RecordMetadataValue } from "@pinecone-database/pinecone";

interface Coordinates {
  x: number;
  y: number;
}

// Add serialization methods for coordinates
interface SerializedCoordinates {
  x: number;
  y: number;
  type: "coordinates";
}

function serializeCoordinates(coords: Coordinates): string {
  return JSON.stringify({
    x: coords.x,
    y: coords.y,
    type: "coordinates",
  });
}

interface LocationNode {
  id: string;
  type:
    | "district_center"
    | "emergency_point"
    | "meeting_point"
    | "transport_hub";
  coordinates: Coordinates;
  districtId: string;
  capacity: number;
  currentOccupancy: number;
  connections: string[]; // IDs of connected nodes
}

export class SpatialCoordinationService extends EventEmitter {
  private locationNodes: Map<string, LocationNode> = new Map();
  private agentLocations: Map<string, Coordinates> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private districtService: DistrictService,
    private emergencyService: EmergencyService
  ) {
    super();
    this.initializeCoordinateSystem();
  }

  async moveAgent(agentId: string, targetLocation: Coordinates) {
    const currentLocation = this.agentLocations.get(agentId);
    if (!currentLocation) return;

    const path = this.calculatePath(currentLocation, targetLocation);
    await this.executeAgentMovement(agentId, path);

    // Store movement in vector DB
    await this.vectorStore.upsert({
      id: `agent-movement-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Agent ${agentId} moved to ${JSON.stringify(targetLocation)}`
      ),
      metadata: {
        type: "district",
        agentId,
        fromLocation: serializeCoordinates(currentLocation),
        toLocation: serializeCoordinates(targetLocation),
        timestamp: Date.now(),
      },
    });
  }

  async getClosestEmergencyPoint(
    coordinates: Coordinates
  ): Promise<LocationNode | null> {
    return Array.from(this.locationNodes.values())
      .filter((node) => node.type === "emergency_point")
      .reduce<LocationNode | null>((closest, current) => {
        const currentDistance = this.calculateDistance(
          coordinates,
          current.coordinates
        );
        const closestDistance = closest
          ? this.calculateDistance(coordinates, closest.coordinates)
          : Infinity;
        return currentDistance < closestDistance ? current : closest;
      }, null);
  }

  async findMeetingPoint(agents: string[]): Promise<LocationNode | null> {
    const agentLocations = agents
      .map((id) => this.agentLocations.get(id))
      .filter((loc): loc is Coordinates => !!loc);

    if (agentLocations.length === 0) return null;

    // Calculate centroid
    const centroid = {
      x:
        agentLocations.reduce((sum, loc) => sum + loc.x, 0) /
        agentLocations.length,
      y:
        agentLocations.reduce((sum, loc) => sum + loc.y, 0) /
        agentLocations.length,
    };

    // Find closest meeting point
    return Array.from(this.locationNodes.values())
      .filter(
        (node) =>
          node.type === "meeting_point" && node.currentOccupancy < node.capacity
      )
      .reduce<LocationNode | null>((closest, current) => {
        const currentDistance = this.calculateDistance(
          centroid,
          current.coordinates
        );
        const closestDistance = closest
          ? this.calculateDistance(centroid, closest.coordinates)
          : Infinity;
        return currentDistance < closestDistance ? current : closest;
      }, null);
  }

  private calculateDistance(point1: Coordinates, point2: Coordinates): number {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  }

  private calculatePath(start: Coordinates, end: Coordinates): Coordinates[] {
    // A* pathfinding implementation
    return [];
  }

  private async executeAgentMovement(agentId: string, path: Coordinates[]) {
    for (const point of path) {
      this.agentLocations.set(agentId, point);
      this.emit("agentMoved", { agentId, location: point });
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate movement time
    }
  }

  private async initializeCoordinateSystem() {
    const districts = await this.districtService.getAllDistricts();
    districts.forEach((district) => {
      this.createDistrictNodes(district);
    });
  }

  private createDistrictNodes(district: District) {
    // Create center node
    const centerNode: LocationNode = {
      id: `center-${district.id}`,
      type: "district_center",
      coordinates: {
        x: district.coordinates[0],
        y: district.coordinates[1],
      },
      districtId: district.id,
      capacity: 100,
      currentOccupancy: 0,
      connections: [],
    };

    // Create emergency points
    const emergencyNode: LocationNode = {
      id: `emergency-${district.id}`,
      type: "emergency_point",
      coordinates: {
        x: district.coordinates[0] + 0.1,
        y: district.coordinates[1] + 0.1,
      },
      districtId: district.id,
      capacity: 50,
      currentOccupancy: 0,
      connections: [centerNode.id],
    };

    this.locationNodes.set(centerNode.id, centerNode);
    this.locationNodes.set(emergencyNode.id, emergencyNode);
  }
}
