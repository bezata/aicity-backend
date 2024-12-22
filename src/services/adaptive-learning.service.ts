import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { MetricsService } from "./metrics.service";
import { CityService } from "./city.service";
import _ from "lodash";
import { CityMetrics } from "../types/city-metrics";

interface CityLearningData {
  successPatterns: Array<{
    pattern: string;
    impact: number;
    replicability: number;
  }>;
  failurePoints: Array<{
    issue: string;
    frequency: number;
    severity: number;
  }>;
  emergingNeeds: string[];
  adaptationOpportunities: Array<{
    area: string;
    potential: number;
    cost: number;
  }>;
}

interface AdaptationPlan {
  infrastructureChanges: Array<{
    type: "upgrade" | "new" | "remove";
    target: string;
    priority: number;
    estimatedImpact: number;
    cost: number;
  }>;
  serviceImprovements: Array<{
    service: string;
    changes: string[];
    expectedBenefit: number;
    implementation: string;
  }>;
  newFeatures: Array<{
    name: string;
    description: string;
    requirements: string[];
    impact: number;
  }>;
}

interface LearningConfig {
  analysisWindow: number; // Time window in milliseconds for pattern analysis
  impactThreshold: number; // Minimum impact score to consider a pattern significant
  adaptationRate: number; // Rate of implementing changes (0-1)
  confidenceThreshold: number; // Minimum confidence for pattern recognition
}

export class AdaptiveLearningService extends EventEmitter {
  private readonly config: LearningConfig = {
    analysisWindow: 7 * 24 * 60 * 60 * 1000, // 1 week
    impactThreshold: 0.7,
    adaptationRate: 0.3,
    confidenceThreshold: 0.8,
  };

  private learningHistory: Map<string, any[]> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private metricsService: MetricsService,
    private cityService: CityService
  ) {
    super();
    this.initializeService();
  }

  private async initializeService() {
    // Start the learning cycle
    setInterval(() => this.evolveCity(), 24 * 60 * 60 * 1000); // Daily adaptation cycle
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.cityService.on("metricsUpdated", this.handleMetricsUpdate.bind(this));
    this.metricsService.on("alert", this.handleMetricsAlert.bind(this));
  }

  async evolveCity() {
    try {
      const learningData = await this.collectCityData();
      const adaptations = await this.generateAdaptations(learningData);
      await this.implementAdaptations(adaptations);

      this.emit("cityEvolved", {
        timestamp: Date.now(),
        adaptations,
        metrics: await this.metricsService.getMetricsAnalysis(),
      });
    } catch (error) {
      console.error("Error in city evolution cycle:", error);
      this.emit("evolutionError", error);
    }
  }

  private async collectCityData(): Promise<CityLearningData> {
    const [
      successPatterns,
      failurePoints,
      emergingNeeds,
      adaptationOpportunities,
    ] = await Promise.all([
      this.analyzeSuccessfulInteractions(),
      this.identifySystemWeaknesses(),
      this.predictFutureNeeds(),
      this.findAdaptationOpportunities(),
    ]);

    return {
      successPatterns,
      failurePoints,
      emergingNeeds,
      adaptationOpportunities,
    };
  }

  private async analyzeSuccessfulInteractions(): Promise<
    Array<{ pattern: string; impact: number; replicability: number }>
  > {
    const recentInteractions = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        "successful city interactions"
      ),
      filter: {
        timestamp: { $gt: Date.now() - this.config.analysisWindow },
      },
      topK: 100,
    });

    const patterns = recentInteractions.matches.reduce(
      (
        acc: Array<{ pattern: string; impact: number; replicability: number }>,
        interaction: any
      ) => {
        const pattern = this.extractInteractionPattern(interaction);
        if (pattern) {
          const existing = acc.find((p) => p.pattern === pattern.pattern);
          if (existing) {
            existing.impact = (existing.impact + pattern.impact) / 2;
            existing.replicability += 0.1;
          } else {
            acc.push(pattern);
          }
        }
        return acc;
      },
      []
    );

    return patterns.filter(
      (p: { impact: number }) => p.impact >= this.config.impactThreshold
    );
  }

  private async identifySystemWeaknesses(): Promise<
    Array<{ issue: string; frequency: number; severity: number }>
  > {
    const metricsAnalysis =
      (await this.metricsService.getMetricsAnalysis()) as {
        current: CityMetrics;
        trends: { improving: string[]; declining: string[]; stable: string[] };
        recommendations: string[];
      };
    const weaknesses: Array<{
      issue: string;
      frequency: number;
      severity: number;
    }> = [];

    // Analyze various metric categories
    for (const [category, categoryMetrics] of Object.entries(
      metricsAnalysis.current
    )) {
      for (const [metric, value] of Object.entries(categoryMetrics)) {
        if (typeof value === "number" && value < 0.6) {
          weaknesses.push({
            issue: `${category}.${metric}`,
            frequency: this.calculateIssueFrequency(`${category}.${metric}`),
            severity: 1 - value,
          });
        }
      }
    }

    return _.orderBy(weaknesses, ["severity", "frequency"], ["desc", "desc"]);
  }

  private async predictFutureNeeds(): Promise<string[]> {
    const cityContext = this.cityService.getContext();
    const trendAnalysis = await this.analyzeTrends(cityContext);
    const projectedNeeds = new Set<string>();

    // Population-based needs
    if (trendAnalysis.populationGrowth > 0.05) {
      projectedNeeds.add("infrastructure_expansion");
      projectedNeeds.add("housing_development");
    }

    // Resource utilization needs
    if (trendAnalysis.resourceUtilization > 0.8) {
      projectedNeeds.add("resource_optimization");
      projectedNeeds.add("sustainable_alternatives");
    }

    // Social needs
    if (trendAnalysis.socialCohesion < 0.6) {
      projectedNeeds.add("community_programs");
      projectedNeeds.add("cultural_initiatives");
    }

    return Array.from(projectedNeeds);
  }

  private async findAdaptationOpportunities(): Promise<
    Array<{ area: string; potential: number; cost: number }>
  > {
    const currentMetrics = await this.metricsService.getMetricsAnalysis();
    const opportunities: Array<{
      area: string;
      potential: number;
      cost: number;
    }> = [];

    // Analyze each metric category for improvement opportunities
    for (const [category, metrics] of Object.entries(currentMetrics.current)) {
      for (const [metric, value] of Object.entries(metrics)) {
        if (typeof value === "number") {
          const improvement = 1 - value;
          if (improvement > 0.3) {
            // Significant room for improvement
            opportunities.push({
              area: `${category}.${metric}`,
              potential: improvement,
              cost: this.estimateImprovementCost(category, metric, improvement),
            });
          }
        }
      }
    }

    return _.orderBy(opportunities, ["potential"], ["desc"]);
  }

  private async generateAdaptations(
    data: CityLearningData
  ): Promise<AdaptationPlan> {
    return {
      infrastructureChanges: await this.suggestInfrastructureUpdates(data),
      serviceImprovements: await this.recommendServiceEnhancements(data),
      newFeatures: await this.proposeNewFeatures(data),
    };
  }

  private async suggestInfrastructureUpdates(data: CityLearningData) {
    const updates: Array<{
      type: "upgrade" | "new" | "remove";
      target: string;
      priority: number;
      estimatedImpact: number;
      cost: number;
    }> = [];

    // Analyze failure points for infrastructure-related issues
    for (const failure of data.failurePoints) {
      if (failure.issue.includes("infrastructure")) {
        updates.push({
          type: "upgrade",
          target: failure.issue,
          priority: failure.severity * failure.frequency,
          estimatedImpact: 0.8,
          cost: this.estimateUpgradeCost(failure.issue),
        });
      }
    }

    // Consider emerging needs for new infrastructure
    for (const need of data.emergingNeeds) {
      if (need.includes("infrastructure")) {
        updates.push({
          type: "new",
          target: need,
          priority: 0.7,
          estimatedImpact: 0.9,
          cost: this.estimateNewInfrastructureCost(need),
        });
      }
    }

    return _.orderBy(updates, ["priority"], ["desc"]);
  }

  private async recommendServiceEnhancements(data: CityLearningData) {
    const improvements: Array<{
      service: string;
      changes: string[];
      expectedBenefit: number;
      implementation: string;
    }> = [];

    // Analyze success patterns for service improvements
    for (const pattern of data.successPatterns) {
      if (pattern.impact > this.config.impactThreshold) {
        improvements.push({
          service: this.extractServiceFromPattern(pattern.pattern),
          changes: [pattern.pattern],
          expectedBenefit: pattern.impact * pattern.replicability,
          implementation: `Replicate success pattern: ${pattern.pattern}`,
        });
      }
    }

    // Address failure points in services
    for (const failure of data.failurePoints) {
      if (this.isServiceRelated(failure.issue)) {
        improvements.push({
          service: this.extractServiceFromIssue(failure.issue),
          changes: [`Fix: ${failure.issue}`],
          expectedBenefit: failure.severity,
          implementation: `Address service failure: ${failure.issue}`,
        });
      }
    }

    return _.orderBy(improvements, ["expectedBenefit"], ["desc"]);
  }

  private async proposeNewFeatures(data: CityLearningData) {
    const features: Array<{
      name: string;
      description: string;
      requirements: string[];
      impact: number;
    }> = [];

    // Convert emerging needs to features
    for (const need of data.emergingNeeds) {
      features.push({
        name: this.generateFeatureName(need),
        description: this.generateFeatureDescription(need),
        requirements: this.identifyFeatureRequirements(need),
        impact: this.estimateFeatureImpact(need),
      });
    }

    // Generate features from adaptation opportunities
    for (const opportunity of data.adaptationOpportunities) {
      if (opportunity.potential > 0.7) {
        features.push({
          name: this.generateFeatureName(opportunity.area),
          description: `New feature to address ${opportunity.area}`,
          requirements: this.identifyFeatureRequirements(opportunity.area),
          impact: opportunity.potential,
        });
      }
    }

    return _.orderBy(features, ["impact"], ["desc"]);
  }

  private async implementAdaptations(adaptations: AdaptationPlan) {
    try {
      // Implement infrastructure changes
      for (const change of adaptations.infrastructureChanges) {
        await this.vectorStore.upsert({
          id: `adaptation-${Date.now()}`,
          values: await this.vectorStore.createEmbedding(
            `Infrastructure adaptation: ${change.type} - ${change.target}`
          ),
          metadata: {
            type: "district",
            subtype: "adaptation",
            impact: change.estimatedImpact,
            cost: change.cost,
            timestamp: Date.now(),
          },
        });
      }

      // Implement service improvements
      for (const improvement of adaptations.serviceImprovements) {
        this.emit("serviceImprovement", {
          service: improvement.service,
          changes: improvement.changes,
          timestamp: Date.now(),
        });
      }

      // Implement new features
      for (const feature of adaptations.newFeatures) {
        this.emit("newFeature", {
          name: feature.name,
          description: feature.description,
          impact: feature.impact,
          timestamp: Date.now(),
        });
      }

      this.emit("adaptationsImplemented", {
        timestamp: Date.now(),
        summary: {
          infrastructureChanges: adaptations.infrastructureChanges.length,
          serviceImprovements: adaptations.serviceImprovements.length,
          newFeatures: adaptations.newFeatures.length,
        },
      });
    } catch (error) {
      console.error("Error implementing adaptations:", error);
      this.emit("adaptationError", error);
    }
  }

  // Helper methods
  private calculateIssueFrequency(issue: string): number {
    const history = this.learningHistory.get(issue) || [];
    const recentIssues = history.filter(
      (h) => h.timestamp > Date.now() - this.config.analysisWindow
    );
    return (
      recentIssues.length / (this.config.analysisWindow / (24 * 60 * 60 * 1000))
    );
  }

  private async analyzeTrends(cityContext: any) {
    return {
      populationGrowth: 0.06, // Example values
      resourceUtilization: 0.85,
      socialCohesion: 0.7,
    };
  }

  private estimateImprovementCost(
    category: string,
    metric: string,
    improvement: number
  ): number {
    // Basic cost estimation based on improvement magnitude
    return improvement * 100000; // Example calculation
  }

  private extractInteractionPattern(interaction: any) {
    // Extract pattern from interaction data
    return {
      pattern: interaction.metadata?.pattern || "unknown",
      impact: interaction.metadata?.impact || 0,
      replicability: interaction.metadata?.replicability || 0,
    };
  }

  private estimateUpgradeCost(issue: string): number {
    // Basic cost estimation
    return 50000; // Example fixed cost
  }

  private estimateNewInfrastructureCost(need: string): number {
    // Basic cost estimation
    return 100000; // Example fixed cost
  }

  private extractServiceFromPattern(pattern: string): string {
    return pattern.split(".")[0];
  }

  private extractServiceFromIssue(issue: string): string {
    return issue.split(".")[0];
  }

  private isServiceRelated(issue: string): boolean {
    return issue.includes("service") || issue.includes("system");
  }

  private generateFeatureName(input: string): string {
    return `Enhanced ${input} System`;
  }

  private generateFeatureDescription(input: string): string {
    return `Feature to enhance ${input} capabilities`;
  }

  private identifyFeatureRequirements(input: string): string[] {
    return [
      `Core ${input} functionality`,
      "Integration capabilities",
      "Performance metrics",
    ];
  }

  private estimateFeatureImpact(input: string): number {
    return 0.8; // Default impact score
  }

  private handleMetricsUpdate(metrics: Record<string, any>) {
    console.log("Metrics updated:", metrics);
  }

  private handleMetricsAlert(alert: Record<string, any>) {
    console.log("Metrics alert:", alert);
  }

  async getCityLearningData(): Promise<CityLearningData> {
    return this.collectCityData();
  }

  async getAdaptationPlans(): Promise<AdaptationPlan[]> {
    const learningData = await this.collectCityData();
    const currentPlan = await this.generateAdaptations(learningData);
    return [currentPlan];
  }

  async createAdaptationPlan(plan: AdaptationPlan): Promise<AdaptationPlan> {
    // Validate and store the plan
    await this.implementAdaptations(plan);
    return plan;
  }

  async getDomainInsights(domain: string): Promise<any> {
    const metrics = (await this.metricsService.getMetricsAnalysis()) as {
      current: CityMetrics;
    };
    const domainMetrics = metrics.current[domain as keyof CityMetrics] || {};
    const trends = await this.analyzeTrends({ domain, metrics: domainMetrics });

    return {
      metrics: domainMetrics,
      trends,
      recommendations: await this.generateDomainRecommendations(domain, trends),
    };
  }

  async handleEvent(event: any): Promise<void> {
    // Process the event and update learning history
    const eventData = {
      timestamp: Date.now(),
      ...event,
    };

    const domain = this.identifyEventDomain(event);
    if (!this.learningHistory.has(domain)) {
      this.learningHistory.set(domain, []);
    }
    this.learningHistory.get(domain)?.push(eventData);

    // Trigger learning cycle if needed
    if (this.shouldTriggerLearning(domain)) {
      await this.evolveCity();
    }
  }

  async getLearningMetrics(): Promise<any> {
    const metrics = {
      totalEvents: Array.from(this.learningHistory.values()).flat().length,
      domainCoverage: this.learningHistory.size,
      lastEvolution: this.lastEvolutionTimestamp,
      adaptationRate: this.config.adaptationRate,
      confidenceLevel: this.config.confidenceThreshold,
      domains: {} as Record<string, any>,
    };

    // Add domain-specific metrics
    for (const [domain, events] of this.learningHistory.entries()) {
      metrics.domains[domain] = {
        eventCount: events.length,
        lastEvent: events[events.length - 1]?.timestamp,
        patterns: await this.analyzeSuccessfulInteractions(),
      };
    }

    return metrics;
  }

  async getRecommendations(): Promise<any> {
    const learningData = await this.collectCityData();
    return {
      immediate: learningData.adaptationOpportunities
        .filter((opp) => opp.potential > 0.7)
        .map((opp) => ({
          type: "high-priority",
          ...opp,
        })),
      planned: learningData.adaptationOpportunities
        .filter((opp) => opp.potential <= 0.7)
        .map((opp) => ({
          type: "planned",
          ...opp,
        })),
      emergingNeeds: learningData.emergingNeeds,
    };
  }

  private lastEvolutionTimestamp: number = Date.now();

  private identifyEventDomain(event: any): string {
    // Logic to identify which domain an event belongs to
    if (event.domain) return event.domain;
    if (event.type?.includes(".")) return event.type.split(".")[0];
    return "general";
  }

  private shouldTriggerLearning(domain: string): boolean {
    const events = this.learningHistory.get(domain) || [];
    const recentEvents = events.filter(
      (e) => e.timestamp > Date.now() - this.config.analysisWindow
    );
    return recentEvents.length >= 10; // Trigger learning after 10 events in window
  }

  private async generateDomainRecommendations(
    domain: string,
    trends: any
  ): Promise<any[]> {
    const recommendations = [];

    if (trends.growth > 0.1) {
      recommendations.push({
        type: "scaling",
        priority: "high",
        description: `Scale ${domain} infrastructure to handle growth`,
      });
    }

    if (trends.efficiency < 0.7) {
      recommendations.push({
        type: "optimization",
        priority: "medium",
        description: `Optimize ${domain} processes for better efficiency`,
      });
    }

    return recommendations;
  }
}
