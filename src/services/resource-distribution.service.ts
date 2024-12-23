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
  type: "water" | "power" | "data" | "supplies";
  capacity: number;
  currentLoad: number;
  location: {
    districtId: string;
    coordinates: [number, number];
  };
  status: "active" | "maintenance" | "overloaded";
}

interface DistrictResources {
  water: { consumption: number; capacity: number };
  power: { consumption: number; capacity: number };
  data: { usage: number; capacity: number };
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
    nodes: new Map<string, ResourceNode>(),
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
    this.initializeDefaultNodes();
  }

  private async initializeDistribution() {
    setInterval(() => this.optimizeNetwork(), 1000 * 60 * 15); // Every 15 minutes
    setInterval(() => this.monitorResourceUsage(), 1000 * 60 * 5); // Every 5 minutes
    setInterval(() => this.balanceLoads(), 1000 * 60 * 10); // Every 10 minutes
  }

  private async optimizeNetwork() {
    const metrics = await this.calculateResourceMetrics();
    if (metrics.efficiency < 0.7) {
      await this.rebalanceResources();
      this.eventBus.emit("resourcesOptimized", metrics);
    }

    const hotspots = await this.identifyDemandHotspots();
    const supplyChains = await this.calculateOptimalSupplyChains(hotspots);
    await this.adjustDistributionNetwork(supplyChains);

    this.distributionNetwork.lastOptimized = Date.now();
    this.emit("networkOptimized", metrics);
  }

  private async calculateResourceMetrics() {
    const nodes = Array.from(this.resourceNodes.values());
    return {
      utilization: this.calculateAverageMetric(
        nodes,
        "currentLoad",
        "capacity"
      ),
      efficiency:
        nodes.reduce(
          (sum, node) => sum + (1 - node.currentLoad / node.capacity),
          0
        ) / nodes.length,
    };
  }

  private async rebalanceResources() {
    const overloadedNodes = Array.from(this.resourceNodes.values()).filter(
      (node) => node.currentLoad / node.capacity > 0.8
    );

    for (const node of overloadedNodes) {
      await this.redistributeLoad(node);
    }
  }

  private async redistributeLoad(node: ResourceNode) {
    const nearbyNodes = Array.from(this.resourceNodes.values()).filter(
      (n) =>
        n.type === node.type &&
        n.id !== node.id &&
        n.currentLoad / n.capacity < 0.6 &&
        this.calculateDistance(
          n.location.coordinates,
          node.location.coordinates
        ) < 5
    );

    if (nearbyNodes.length > 0) {
      const targetNode = this.selectOptimalTargetNode(nearbyNodes);
      const redistributionAmount = this.calculateRedistributionAmount(
        node,
        targetNode
      );
      await this.transferLoad(node, targetNode, redistributionAmount);

      this.eventBus.emit("loadRedistributed", {
        sourceId: node.id,
        targetId: targetNode.id,
        amount: redistributionAmount,
        efficiency: 0.9,
      });
    }
  }

  private selectOptimalTargetNode(nodes: ResourceNode[]): ResourceNode {
    return nodes.reduce((best, current) => {
      const score = 1 - current.currentLoad / current.capacity;
      const bestScore = 1 - best.currentLoad / best.capacity;
      return score > bestScore ? current : best;
    });
  }

  private calculateRedistributionAmount(
    source: ResourceNode,
    target: ResourceNode
  ): number {
    const excessLoad = source.currentLoad - source.capacity * 0.7;
    const targetCapacity = target.capacity - target.currentLoad;
    return Math.min(excessLoad, targetCapacity);
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
      efficiency: 0.9,
      timestamp: Date.now(),
    };

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

  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [x1, y1] = coord1;
    const [x2, y2] = coord2;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  private calculateDistrictCenter(
    boundaries: Array<[number, number]>
  ): [number, number] {
    const sumLat = boundaries.reduce((sum, coord) => sum + coord[0], 0);
    const sumLng = boundaries.reduce((sum, coord) => sum + coord[1], 0);
    return [sumLat / boundaries.length, sumLng / boundaries.length];
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
          priority: 1,
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
      const sourceNode = this.resourceNodes.get(chain.source.id);
      if (sourceNode) {
        sourceNode.currentLoad += chain.amount;
        this.resourceNodes.set(sourceNode.id, sourceNode);
      }

      this.distributionNetwork.connections.push({
        sourceId: chain.source.id,
        destinationCoordinates: chain.destination.location,
        capacity: chain.amount * 1.2,
        load: chain.amount,
        status: "active",
        priority: chain.priority,
      });
    }
  }

  private async initializeDefaultNodes() {
    // Initialize water resource nodes
    this.resourceNodes.set("water-node-1", {
      id: "water-node-1",
      type: "water",
      capacity: 1000,
      currentLoad: 600,
      status: "active",
      location: {
        districtId: "main",
        coordinates: [0, 0],
      },
    });

    // Initialize power resource nodes
    this.resourceNodes.set("power-node-1", {
      id: "power-node-1",
      type: "power",
      capacity: 2000,
      currentLoad: 1200,
      status: "active",
      location: {
        districtId: "main",
        coordinates: [1, 1],
      },
    });

    // Initialize data resource nodes
    this.resourceNodes.set("data-node-1", {
      id: "data-node-1",
      type: "data",
      capacity: 5000,
      currentLoad: 2500,
      status: "active",
      location: {
        districtId: "main",
        coordinates: [2, 2],
      },
    });

    // Initialize supplies resource nodes
    this.resourceNodes.set("supplies-node-1", {
      id: "supplies-node-1",
      type: "supplies",
      capacity: 1500,
      currentLoad: 900,
      status: "active",
      location: {
        districtId: "main",
        coordinates: [3, 3],
      },
    });

    console.log(`Initialized ${this.resourceNodes.size} resource nodes`);
    this.distributionNetwork.nodes = this.resourceNodes;
    this.createInitialConnections();
  }

  private createInitialConnections() {
    const nodes = Array.from(this.resourceNodes.values());

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = this.calculateDistance(
          nodes[i].location.coordinates,
          nodes[j].location.coordinates
        );

        if (distance < 5) {
          this.distributionNetwork.connections.push({
            sourceId: nodes[i].id,
            destinationCoordinates: nodes[j].location.coordinates,
            capacity: Math.min(nodes[i].capacity, nodes[j].capacity) * 0.5,
            load: 0,
            status: "active",
            priority: 1,
          });
        }
      }
    }

    console.log(
      `Created ${this.distributionNetwork.connections.length} initial connections`
    );
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
    }

    return hotspots;
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
}
