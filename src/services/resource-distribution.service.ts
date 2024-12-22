import { EventEmitter } from "events";
import {
  DistributionNetwork,
  Connection,
} from "../types/social-cohesion.types";
import { DistrictService } from "./district.service";
import { SmartInfrastructureService } from "./smart-infrastructure.service";
import { EventBus } from "./event-bus.service";
import { VectorStoreService } from "./vector-store.service";
import type { DistrictInfrastructure } from "../types/smart-infrastructure.types";

interface ResourceNode {
  id: string;
  type:
    | "water"
    | "power"
    | "data"
    | "supplies"
    | "ai_compute"
    | "neural_bandwidth";
  capacity: number;
  currentLoad: number;
  status: "active" | "maintenance" | "offline";
  location: {
    coordinates: [number, number];
  };
  aiOptimization: {
    predictionAccuracy: number;
    adaptiveRouting: number;
    loadBalancingEfficiency: number;
  };
}

interface AIResourceMetrics {
  computeUtilization: number;
  bandwidthAllocation: number;
  processingLatency: number;
  resourceEfficiency: number;
  adaptationScore: number;
}

interface DistrictResources {
  water: { consumption: number; capacity: number };
  power: { consumption: number; capacity: number };
  data: { usage: number; capacity: number };
  compute?: { usage: number; capacity: number };
  bandwidth?: { usage: number; capacity: number };
}

interface ResourceTransfer {
  sourceId: string;
  targetId: string;
  amount: number;
  efficiency: number;
  timestamp: number;
}

export class ResourceDistributionService extends EventEmitter {
  private resourceNodes: Map<string, ResourceNode> = new Map();
  private distributionNetwork: DistributionNetwork = {
    nodes: new Map(),
    connections: [],
    efficiency: 1,
    lastOptimized: Date.now(),
  };
  private readonly eventBus: EventBus;

  constructor(
    private districtService: DistrictService,
    private smartInfrastructure: SmartInfrastructureService,
    private vectorStore: VectorStoreService
  ) {
    super();
    this.eventBus = EventBus.getInstance();
    this.initializeDistribution();
  }

  private async initializeDistribution() {
    setInterval(() => this.optimizeNetwork(), 1000 * 60 * 15); // Every 15 minutes
    setInterval(() => this.monitorResourceUsage(), 1000 * 60 * 5); // Every 5 minutes
    setInterval(() => this.balanceLoads(), 1000 * 60 * 10); // Every 10 minutes
    setInterval(() => this.optimizeAIResources(), 1000 * 60 * 3); // Every 3 minutes
  }

  private async optimizeAIResources() {
    const metrics = await this.calculateAIResourceMetrics();
    if (metrics.resourceEfficiency < 0.7) {
      await this.rebalanceAIResources();
      this.eventBus.emit("aiResourcesOptimized", metrics);
    }
  }

  private async calculateAIResourceMetrics(): Promise<AIResourceMetrics> {
    const aiNodes = Array.from(this.resourceNodes.values()).filter(
      (node) => node.type === "ai_compute" || node.type === "neural_bandwidth"
    );

    return {
      computeUtilization: this.calculateAverageMetric(
        aiNodes,
        "currentLoad",
        "capacity"
      ),
      bandwidthAllocation: this.calculateAverageMetric(
        aiNodes,
        "currentLoad",
        "capacity"
      ),
      processingLatency: this.calculateAverageLatency(aiNodes),
      resourceEfficiency: this.calculateResourceEfficiency(aiNodes),
      adaptationScore: this.calculateAverageMetric(
        aiNodes,
        "aiOptimization.adaptiveRouting"
      ),
    };
  }

  private async rebalanceAIResources() {
    const aiNodes = Array.from(this.resourceNodes.values()).filter(
      (node) => node.type === "ai_compute" || node.type === "neural_bandwidth"
    );

    for (const node of aiNodes) {
      if (node.currentLoad / node.capacity > 0.8) {
        await this.redistributeAILoad(node);
      }
    }
  }

  private async redistributeAILoad(node: ResourceNode) {
    const nearbyAINodes = Array.from(this.resourceNodes.values()).filter(
      (n) =>
        (n.type === "ai_compute" || n.type === "neural_bandwidth") &&
        n.id !== node.id &&
        n.currentLoad / n.capacity < 0.6 &&
        this.calculateDistance(
          n.location.coordinates,
          node.location.coordinates
        ) < 5
    );

    if (nearbyAINodes.length > 0) {
      const targetNode = this.selectOptimalTargetNode(nearbyAINodes);
      const redistributionAmount = this.calculateRedistributionAmount(
        node,
        targetNode
      );

      await this.transferLoad(node, targetNode, redistributionAmount);

      this.eventBus.emit("aiLoadRedistributed", {
        sourceId: node.id,
        targetId: targetNode.id,
        amount: redistributionAmount,
        efficiency: targetNode.aiOptimization.loadBalancingEfficiency,
      });
    }
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
      const resources = infrastructure.resources as DistrictResources;
      const boundaries = district.boundaries;
      const districtCenter: [number, number] =
        this.calculateDistrictCenter(boundaries);

      // Check traditional resources
      if (resources.water.consumption > resources.water.capacity * 0.8) {
        hotspots.push({
          location: districtCenter,
          demand: resources.water.consumption,
          resourceType: "water" as const,
        });
      }

      if (resources.power.consumption > resources.power.capacity * 0.8) {
        hotspots.push({
          location: districtCenter,
          demand: resources.power.consumption,
          resourceType: "power" as const,
        });
      }

      if (resources.data.usage > resources.data.capacity * 0.8) {
        hotspots.push({
          location: districtCenter,
          demand: resources.data.usage,
          resourceType: "data" as const,
        });
      }

      // Check AI-specific resources
      if (
        resources.compute &&
        resources.compute.usage > resources.compute.capacity * 0.7
      ) {
        hotspots.push({
          location: districtCenter,
          demand: resources.compute.usage,
          resourceType: "ai_compute" as const,
        });
      }

      if (
        resources.bandwidth &&
        resources.bandwidth.usage > resources.bandwidth.capacity * 0.7
      ) {
        hotspots.push({
          location: districtCenter,
          demand: resources.bandwidth.usage,
          resourceType: "neural_bandwidth" as const,
        });
      }
    }

    return hotspots;
  }

  private calculateDistrictCenter(
    boundaries: Array<[number, number]>
  ): [number, number] {
    const sumLat = boundaries.reduce((sum, coord) => sum + coord[0], 0);
    const sumLng = boundaries.reduce((sum, coord) => sum + coord[1], 0);
    return [sumLat / boundaries.length, sumLng / boundaries.length];
  }

  private selectOptimalTargetNode(nodes: ResourceNode[]): ResourceNode {
    return nodes.reduce((best, current) => {
      const score =
        (1 - current.currentLoad / current.capacity) * 0.4 +
        current.aiOptimization.loadBalancingEfficiency * 0.3 +
        current.aiOptimization.predictionAccuracy * 0.3;

      const bestScore =
        (1 - best.currentLoad / best.capacity) * 0.4 +
        best.aiOptimization.loadBalancingEfficiency * 0.3 +
        best.aiOptimization.predictionAccuracy * 0.3;

      return score > bestScore ? current : best;
    });
  }

  private calculateRedistributionAmount(
    source: ResourceNode,
    target: ResourceNode
  ): number {
    const excessLoad = source.currentLoad - source.capacity * 0.7;
    const targetCapacity = target.capacity - target.currentLoad;
    const baseAmount = Math.min(excessLoad, targetCapacity);

    // Adjust based on AI optimization metrics
    const efficiencyFactor =
      (source.aiOptimization.loadBalancingEfficiency +
        target.aiOptimization.loadBalancingEfficiency) /
      2;

    return baseAmount * efficiencyFactor;
  }

  private async transferLoad(
    source: ResourceNode,
    target: ResourceNode,
    amount: number
  ) {
    source.currentLoad -= amount;
    target.currentLoad += amount;

    const transfer: ResourceTransfer = {
      sourceId: source.id,
      targetId: target.id,
      amount,
      efficiency: target.aiOptimization.loadBalancingEfficiency,
      timestamp: Date.now(),
    };

    // Store transfer in vector DB for analysis
    await this.vectorStore.upsert({
      id: `transfer-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Resource transfer from ${source.id} to ${target.id}: ${amount}`
      ),
      metadata: {
        type: "district" as const,
        transfer: JSON.stringify(transfer),
        timestamp: Date.now(),
      },
    });
  }

  private calculateAverageMetric(
    nodes: ResourceNode[],
    ...paths: string[]
  ): number {
    return (
      nodes.reduce((sum, node) => {
        let value: any = node;
        for (const path of paths) {
          value = value[path];
        }
        return sum + (typeof value === "number" ? value : 0);
      }, 0) / Math.max(nodes.length, 1)
    );
  }

  private calculateAverageLatency(nodes: ResourceNode[]): number {
    return (
      nodes.reduce(
        (sum, node) => sum + (1 - node.aiOptimization.loadBalancingEfficiency),
        0
      ) / nodes.length
    );
  }

  private calculateResourceEfficiency(nodes: ResourceNode[]): number {
    return (
      nodes.reduce(
        (sum, node) =>
          sum +
          (node.aiOptimization.loadBalancingEfficiency * 0.4 +
            node.aiOptimization.predictionAccuracy * 0.3 +
            node.aiOptimization.adaptiveRouting * 0.3),
        0
      ) / nodes.length
    );
  }

  private async optimizeNetwork() {
    const hotspots = await this.identifyDemandHotspots();
    const supplyChains = await this.calculateOptimalSupplyChains(hotspots);
    await this.adjustDistributionNetwork(supplyChains);

    this.distributionNetwork.lastOptimized = Date.now();
    this.emit("networkOptimized", this.calculateNetworkMetrics());
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
