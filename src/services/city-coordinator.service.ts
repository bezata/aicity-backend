import { EventEmitter } from "events";
import {
  DomainType,
  CityMetrics,
  AgentProposal,
  CoordinationEvent,
} from "../types/city-coordinator.types";
import { VectorStoreService } from "./vector-store.service";
import { DepartmentService } from "./department.service";
import { EnvironmentService } from "./environment.service";
import { TransportService } from "./transport.service";
import { SocialDynamicsService } from "./social-dynamics.service";
import { EnvironmentalAlert } from "../types/environment.types";
import { TransportRoute } from "../types/transport.types";

// Add these interfaces for type safety
interface MetricsData {
  metrics: Partial<CityMetrics>;
  priority: number;
  timeframe: number;
  cost: number;
}

interface EnvironmentalData {
  airQuality: number;
  waterQuality: number;
}

export class CityCoordinatorService extends EventEmitter {
  private currentMetrics: CityMetrics;
  private activeProposals: Map<string, AgentProposal> = new Map();
  private implementationQueue: AgentProposal[] = [];

  constructor(
    private vectorStore: VectorStoreService,
    private departmentService: DepartmentService,
    private environmentService: EnvironmentService,
    private transportService: TransportService,
    private socialDynamicsService: SocialDynamicsService
  ) {
    super();
    this.currentMetrics = {
      sustainability: {
        carbonEmissions: 0,
        renewableEnergyRatio: 0,
        greenSpaceIndex: 0,
        airQualityScore: 0,
        waterQualityScore: 0,
      },
      economy: {
        employmentRate: 0,
        jobGrowth: 0,
        giniCoefficient: 0,
        businessFormationRate: 0,
        affordabilityIndex: 0,
      },
      social: {
        healthcareAccess: 0,
        educationQuality: 0,
        culturalEngagement: 0,
        civicParticipation: 0,
        communityWellbeing: 0,
      },
      infrastructure: {
        trafficCongestion: 0,
        publicTransitReliability: 0,
        wasteRecyclingRate: 0,
        infrastructureHealth: 0,
        housingAvailability: 0,
      },
    };
    this.initializeCoordinator();
  }

  private async initializeCoordinator() {
    // Initialize city metrics
    this.currentMetrics = await this.gatherCityMetrics();

    // Start coordination cycles
    setInterval(() => this.updateCityMetrics(), 1000 * 60 * 30); // Every 30 minutes
    setInterval(() => this.evaluateProposals(), 1000 * 60 * 60); // Every hour
    setInterval(() => this.processImplementationQueue(), 1000 * 60 * 15); // Every 15 minutes

    // Listen to domain events
    this.environmentService.on(
      "environmentalAlert",
      this.handleEnvironmentalEvent.bind(this)
    );
    this.transportService.on(
      "metricsUpdated",
      this.handleTransportEvent.bind(this)
    );
    this.socialDynamicsService.on(
      "communityMoodUpdated",
      this.handleSocialEvent.bind(this)
    );
  }

  async submitProposal(
    proposal: Omit<AgentProposal, "id" | "status">
  ): Promise<AgentProposal> {
    const newProposal: AgentProposal = {
      id: crypto.randomUUID(),
      ...proposal,
      status: "proposed",
    };

    await this.validateProposal(newProposal);
    await this.simulateProposal(newProposal);
    this.activeProposals.set(newProposal.id, newProposal);

    return newProposal;
  }

  private async validateProposal(proposal: AgentProposal) {
    // Check dependencies
    for (const depId of proposal.requirements.dependencies) {
      const dep = this.activeProposals.get(depId);
      if (!dep || dep.status === "rejected") {
        throw new Error(`Invalid dependency: ${depId}`);
      }
    }

    // Verify department approvals
    const departments = await this.departmentService.getAllDepartments();
    const validDepartments = new Set(departments.map((d) => d.id));
    for (const deptId of proposal.requirements.approvals) {
      if (!validDepartments.has(deptId)) {
        throw new Error(`Invalid department: ${deptId}`);
      }
    }
  }

  private async simulateProposal(proposal: AgentProposal) {
    proposal.status = "simulating";

    // Store simulation in vector DB with proper typing
    await this.vectorStore.upsert({
      id: `proposal-sim-${proposal.id}`,
      values: await this.vectorStore.createEmbedding(
        `${proposal.domain} proposal: ${proposal.title}`
      ),
      metadata: {
        type: "district",
        proposalId: proposal.id,
        domain: proposal.domain,
        impactData: JSON.stringify(proposal.impact), // Convert to string for storage
        timestamp: Date.now(),
      },
    });

    // Update proposal status based on simulation results
    if (proposal.simulation.confidence > 0.7) {
      proposal.status = "approved";
      this.implementationQueue.push(proposal);
    } else {
      proposal.status = "rejected";
    }

    this.emit("proposalSimulated", { proposal });
  }

  private async evaluateProposals() {
    const proposals = Array.from(this.activeProposals.values()).filter(
      (p) => p.status === "approved"
    );

    // Sort by priority and impact
    proposals.sort((a, b) => {
      const scoreA = this.calculateProposalScore(a);
      const scoreB = this.calculateProposalScore(b);
      return scoreB - scoreA;
    });

    // Update implementation queue
    this.implementationQueue = proposals;
  }

  private calculateProposalScore(proposal: AgentProposal): number {
    const impactScore = Object.values(proposal.impact.metrics).reduce(
      (sum: number, metric: any) => sum + this.normalizeMetric(metric),
      0
    );

    return (
      impactScore * 0.4 +
      proposal.impact.priority * 0.3 +
      proposal.simulation.confidence * 0.3
    );
  }

  private normalizeMetric(metric: any): number {
    if (typeof metric === "number") {
      return metric;
    }
    if (typeof metric === "object" && metric !== null) {
      return Object.values(metric).reduce(
        (sum: number, val: any) => sum + this.normalizeMetric(val),
        0
      );
    }
    return 0;
  }

  private async processImplementationQueue() {
    const proposal = this.implementationQueue[0];
    if (!proposal) return;

    try {
      await this.implementProposal(proposal);
      this.implementationQueue.shift();
    } catch (error) {
      console.error(`Failed to implement proposal ${proposal.id}:`, error);
      proposal.status = "rejected";
    }
  }

  private async implementProposal(proposal: AgentProposal) {
    // Notify relevant departments
    for (const deptId of proposal.requirements.approvals) {
      await this.departmentService.addActivity(deptId, {
        type: "proposal_implementation",
        proposalId: proposal.id,
        timestamp: Date.now(),
      });
    }

    // Update proposal status
    proposal.status = "implementing";
    this.activeProposals.set(proposal.id, proposal);

    // Record implementation event
    const event: CoordinationEvent = {
      type: "implementation",
      timestamp: Date.now(),
      agentId: proposal.domain,
      proposalId: proposal.id,
      details: {
        metrics: proposal.impact.metrics,
        requirements: proposal.requirements,
      },
    };

    await this.recordEvent(event);
  }

  private async recordEvent(event: CoordinationEvent) {
    await this.vectorStore.upsert({
      id: `coordination-event-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `${event.type} event for ${event.agentId}`
      ),
      metadata: {
        type: "district",
        eventType: event.type,
        agentId: event.agentId,
        proposalId: event.proposalId,
        timestamp: event.timestamp,
      },
    });

    this.emit("coordinationEvent", event);
  }

  private async gatherCityMetrics(): Promise<CityMetrics> {
    // Implement metric gathering from various services
    return {
      sustainability: await this.getSustainabilityMetrics(),
      economy: await this.getEconomyMetrics(),
      social: await this.getSocialMetrics(),
      infrastructure: await this.getInfrastructureMetrics(),
    };
  }

  private async handleEnvironmentalEvent(alert: EnvironmentalAlert) {
    // Update sustainability metrics based on environmental alerts
    this.currentMetrics.sustainability = {
      ...this.currentMetrics.sustainability,
      airQualityScore:
        alert.type === "air"
          ? this.calculateAirQualityScore(alert.metrics.airQuality)
          : this.currentMetrics.sustainability.airQualityScore,
      waterQualityScore:
        alert.type === "water"
          ? this.calculateWaterQualityScore(alert.metrics.water)
          : this.currentMetrics.sustainability.waterQualityScore,
    };
  }

  private async handleTransportEvent(routes: TransportRoute[]) {
    // Update infrastructure metrics based on transport data
    const congestionLevels = routes.map((r) => r.metrics.efficiency);
    const avgCongestion =
      congestionLevels.reduce((a, b) => a + b, 0) / congestionLevels.length;

    this.currentMetrics.infrastructure = {
      ...this.currentMetrics.infrastructure,
      trafficCongestion: 1 - avgCongestion,
      publicTransitReliability: this.calculateTransitReliability(routes),
    };
  }

  private async handleSocialEvent(communityMood: Record<string, number>) {
    // Update social metrics based on community mood
    const avgMood =
      Object.values(communityMood).reduce((a, b) => a + b, 0) /
      Object.values(communityMood).length;

    this.currentMetrics.social = {
      ...this.currentMetrics.social,
      communityWellbeing: avgMood,
    };
  }

  private async updateCityMetrics() {
    this.currentMetrics = await this.gatherCityMetrics();
    this.emit("metricsUpdated", this.currentMetrics);
  }

  private async getSustainabilityMetrics(): Promise<
    CityMetrics["sustainability"]
  > {
    const environmentalData = await Promise.all(
      Array.from(this.environmentService.getActiveAlerts())
    );

    return {
      carbonEmissions: await this.calculateCarbonEmissions(),
      renewableEnergyRatio: await this.calculateEnergyRatio(),
      greenSpaceIndex: await this.calculateGreenSpaceIndex(),
      airQualityScore: this.calculateAverageAirQuality(
        environmentalData as EnvironmentalAlert[]
      ),
      waterQualityScore: this.calculateAverageWaterQuality(
        environmentalData as EnvironmentalAlert[]
      ),
    };
  }

  private async getEconomyMetrics(): Promise<CityMetrics["economy"]> {
    return {
      employmentRate: 0.92, // To be implemented with real data
      jobGrowth: 2.5,
      giniCoefficient: 0.35,
      businessFormationRate: 12.5,
      affordabilityIndex: 0.65,
    };
  }

  private async getSocialMetrics(): Promise<CityMetrics["social"]> {
    return {
      healthcareAccess: 0.85,
      educationQuality: 0.78,
      culturalEngagement: 0.72,
      civicParticipation: 0.65,
      communityWellbeing: 0.81,
    };
  }

  private async getInfrastructureMetrics(): Promise<
    CityMetrics["infrastructure"]
  > {
    const routes = await this.transportService.getRoutes();
    const transportRoutes = Array.from(routes.values()) as TransportRoute[];

    return {
      trafficCongestion: 1 - this.calculateAverageCongestion(transportRoutes),
      publicTransitReliability:
        this.calculateTransitReliability(transportRoutes),
      wasteRecyclingRate: 0.45,
      infrastructureHealth: 0.88,
      housingAvailability: 0.72,
    };
  }

  // Helper methods for calculations
  private calculateAirQualityScore(metrics: any): number {
    return metrics ? Math.max(0, 100 - metrics.aqi) / 100 : 0.7;
  }

  private calculateWaterQualityScore(metrics: any): number {
    return metrics?.quality || 0.8;
  }

  private calculateTransitReliability(routes: TransportRoute[]): number {
    return (
      routes.reduce((acc, route) => acc + route.metrics.reliability, 0) /
      routes.length
    );
  }

  private calculateAverageCongestion(routes: TransportRoute[]): number {
    return (
      routes.reduce((acc, route) => acc + route.metrics.utilization, 0) /
      routes.length
    );
  }

  private async calculateCarbonEmissions(): Promise<number> {
    // Implement real calculation based on various data sources
    return 8.5;
  }

  private async calculateEnergyRatio(): Promise<number> {
    // Implement real calculation based on energy data
    return 0.35;
  }

  private async calculateGreenSpaceIndex(): Promise<number> {
    const environmentalMetrics =
      await this.environmentService.getDistrictMetrics("all");
    if (!environmentalMetrics) return 0.5; // Default value if no data

    const districts = Array.from(environmentalMetrics.values());
    const totalGreenSpace = districts.reduce<number>((acc, metrics) => {
      if (
        metrics &&
        metrics.greenSpace &&
        typeof metrics.greenSpace.coverage === "number"
      ) {
        return acc + metrics.greenSpace.coverage / 100;
      }
      return acc;
    }, 0);

    return totalGreenSpace / Math.max(districts.length, 1);
  }

  // Add these helper methods for air and water quality calculations
  private calculateAverageAirQuality(data: EnvironmentalAlert[]): number {
    const airQualityAlerts = data.filter((alert) => alert.type === "air");
    if (airQualityAlerts.length === 0) return 80; // Default good air quality

    return (
      airQualityAlerts.reduce(
        (acc, alert) => acc + (alert.metrics.airQuality?.aqi || 0),
        0
      ) / airQualityAlerts.length
    );
  }

  private calculateAverageWaterQuality(data: EnvironmentalAlert[]): number {
    const waterAlerts = data.filter((alert) => alert.type === "water");
    if (waterAlerts.length === 0) return 0.9; // Default good water quality

    return (
      waterAlerts.reduce(
        (acc, alert) => acc + (alert.metrics.water?.quality || 0),
        0
      ) / waterAlerts.length
    );
  }
}
