import { EventEmitter } from "events";
import {
  DistributionNetwork,
  Connection,
} from "../types/social-cohesion.types";
import { DistrictService } from "./district.service";
import { SmartInfrastructureService } from "./smart-infrastructure.service";
import type { DistrictInfrastructure } from "../types/smart-infrastructure.types";

interface ResourceNode {
  id: string;
  type: "water" | "power" | "data" | "supplies";
  capacity: number;
  currentLoad: number;
  status: "active" | "maintenance" | "offline";
  location: {
    coordinates: [number, number];
  };
}

export class ResourceDistributionService extends EventEmitter {
  private resourceNodes: Map<string, ResourceNode> = new Map();
  private distributionNetwork: DistributionNetwork = {
    nodes: new Map(),
    connections: [],
    efficiency: 1,
    lastOptimized: Date.now(),
  };

  constructor(
    private districtService: DistrictService,
    private smartInfrastructure: SmartInfrastructureService
  ) {
    super();
    this.initializeDistribution();
  }

  private async initializeDistribution() {
    setInterval(() => this.optimizeNetwork(), 1000 * 60 * 15); // Every 15 minutes
    setInterval(() => this.monitorResourceUsage(), 1000 * 60 * 5); // Every 5 minutes
    setInterval(() => this.balanceLoads(), 1000 * 60 * 10); // Every 10 minutes
  }

  private async optimizeNetwork() {
    const hotspots = await this.identifyDemandHotspots();
    const supplyChains = await this.calculateOptimalSupplyChains(hotspots);
    await this.adjustDistributionNetwork(supplyChains);

    this.distributionNetwork.lastOptimized = Date.now();
    this.emit("networkOptimized", this.calculateNetworkMetrics());
  }

  private async identifyDemandHotspots(): Promise<
    Array<{
      location: [number, number];
      demand: number;
      resourceType: ResourceNode["type"];
    }>
  > {
    const districts = await this.districtService.getAllDistricts();
    const hotspots = [];

    for (const district of districts) {
      const infrastructure =
        await this.smartInfrastructure.getDistrictInfrastructure(district.id);

      // Check water demand
      if (
        infrastructure.resources.water.consumption >
        infrastructure.resources.water.capacity * 0.8
      ) {
        hotspots.push({
          location: district.coordinates,
          demand: infrastructure.resources.water.consumption,
          resourceType: "water" as const,
        });
      }

      // Check power demand
      if (
        infrastructure.resources.power.consumption >
        infrastructure.resources.power.capacity * 0.8
      ) {
        hotspots.push({
          location: district.coordinates,
          demand: infrastructure.resources.power.consumption,
          resourceType: "power" as const,
        });
      }

      // Check data demand
      if (
        infrastructure.resources.data.usage >
        infrastructure.resources.data.capacity * 0.8
      ) {
        hotspots.push({
          location: district.coordinates,
          demand: infrastructure.resources.data.usage,
          resourceType: "data" as const,
        });
      }
    }

    return hotspots;
  }

  private async calculateOptimalSupplyChains(
    demandHotspots: Array<{
      location: [number, number];
      demand: number;
      resourceType: ResourceNode["type"];
    }>
  ) {
    const supplyChains = [];

    for (const hotspot of demandHotspots) {
      // Find nearest available resource nodes
      const availableNodes = Array.from(this.resourceNodes.values())
        .filter(
          (node) =>
            node.type === hotspot.resourceType &&
            node.currentLoad < node.capacity * 0.9
        )
        .sort(
          (a, b) =>
            this.calculateDistance(a.location.coordinates, hotspot.location) -
            this.calculateDistance(b.location.coordinates, hotspot.location)
        );

      if (availableNodes.length > 0) {
        supplyChains.push({
          source: availableNodes[0],
          destination: hotspot,
          amount: hotspot.demand,
          priority: this.calculatePriority(hotspot),
        });
      }
    }

    return supplyChains;
  }

  private async adjustDistributionNetwork(
    supplyChains: Array<{
      source: ResourceNode;
      destination: { location: [number, number] };
      amount: number;
      priority: number;
    }>
  ) {
    for (const chain of supplyChains) {
      // Update node loads
      const sourceNode = this.resourceNodes.get(chain.source.id);
      if (sourceNode) {
        sourceNode.currentLoad += chain.amount;
        this.resourceNodes.set(sourceNode.id, sourceNode);
      }

      // Create or update connection
      const connection: Connection = {
        sourceId: chain.source.id,
        destinationCoordinates: chain.destination.location,
        capacity: chain.amount,
        load: chain.amount,
        status: "active",
        priority: chain.priority,
      };

      this.distributionNetwork.connections.push(connection);
    }

    this.emit("networkUpdated", this.distributionNetwork);
  }

  private calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    return Math.sqrt(
      Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2)
    );
  }

  private calculatePriority(hotspot: {
    demand: number;
    resourceType: string;
  }): number {
    const basePriority = hotspot.demand / 100;
    const typePriority =
      {
        water: 1,
        power: 0.9,
        data: 0.8,
        supplies: 0.7,
      }[hotspot.resourceType] || 0.5;

    return Math.min(1, basePriority * typePriority);
  }

  private calculateNetworkMetrics() {
    const totalNodes = this.resourceNodes.size;
    const activeNodes = Array.from(this.resourceNodes.values()).filter(
      (node) => node.status === "active"
    ).length;
    const averageLoad =
      Array.from(this.resourceNodes.values()).reduce(
        (sum, node) => sum + node.currentLoad / node.capacity,
        0
      ) / totalNodes;

    return {
      nodeCount: totalNodes,
      activeNodeRatio: activeNodes / totalNodes,
      averageLoad,
      efficiency: this.distributionNetwork.efficiency,
      connectionCount: this.distributionNetwork.connections.length,
    };
  }

  private async monitorResourceUsage() {
    for (const node of this.resourceNodes.values()) {
      if (node.currentLoad > node.capacity * 0.9) {
        this.emit("resourceWarning", {
          nodeId: node.id,
          type: node.type,
          load: node.currentLoad,
          capacity: node.capacity,
        });
      }
    }
  }

  private async balanceLoads() {
    const overloadedNodes = Array.from(this.resourceNodes.values()).filter(
      (node) => node.currentLoad > node.capacity * 0.8
    );

    for (const node of overloadedNodes) {
      await this.redistributeLoad(node);
    }
  }

  private async redistributeLoad(node: ResourceNode) {
    const nearbyNodes = Array.from(this.resourceNodes.values())
      .filter(
        (n) =>
          n.id !== node.id &&
          n.type === node.type &&
          n.currentLoad < n.capacity * 0.6 &&
          this.calculateDistance(
            n.location.coordinates,
            node.location.coordinates
          ) < 10
      )
      .sort((a, b) => a.currentLoad / a.capacity - b.currentLoad / b.capacity);

    if (nearbyNodes.length > 0) {
      const excessLoad = node.currentLoad - node.capacity * 0.7;
      const redistributionAmount = Math.min(
        excessLoad,
        nearbyNodes[0].capacity - nearbyNodes[0].currentLoad
      );

      node.currentLoad -= redistributionAmount;
      nearbyNodes[0].currentLoad += redistributionAmount;

      this.emit("loadRedistributed", {
        sourceId: node.id,
        targetId: nearbyNodes[0].id,
        amount: redistributionAmount,
      });
    }
  }
}
