import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { MetricsService } from "./metrics.service";
import { CityService } from "./city.service";
import { DistrictService } from "./district.service";
import { AgentConversationService } from "./agent-conversation.service";
import { SocialDynamicsService } from "./social-dynamics.service";
import _ from "lodash";
import { CityMetrics } from "../types/city-metrics";
import { ConversationEvent } from "../types/conversation.types";
import { DistrictEvent } from "../types/district.types";
import { SocialPattern } from "../types/social-dynamics.types";

interface DistrictLearningData {
  districtId: string;
  patterns: Array<{
    type: string;
    success: boolean;
    impact: number;
  }>;
  adaptations: AdaptationPlan;
  metrics: {
    socialCohesion: number;
    economicActivity: number;
    environmentalHealth: number;
  };
}

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
  districtLearning: Map<string, DistrictLearningData>;
  socialPatterns: Array<{
    pattern: SocialPattern;
    frequency: number;
    impact: number;
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
  private districtLearning: Map<string, DistrictLearningData> = new Map();
  private socialPatterns: Map<string, SocialPattern[]> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private metricsService: MetricsService,
    private cityService: CityService,
    private districtService: DistrictService,
    private agentConversationService: AgentConversationService,
    private socialDynamicsService: SocialDynamicsService
  ) {
    super();
    this.initializeService();
  }

  private async initializeService() {
    // Initialize district learning data
    const districts = await this.districtService.getAllDistricts();
    districts.forEach((district) => {
      this.districtLearning.set(district.id, {
        districtId: district.id,
        patterns: [],
        adaptations: {
          infrastructureChanges: [],
          serviceImprovements: [],
          newFeatures: [],
        },
        metrics: {
          socialCohesion: 0,
          economicActivity: 0,
          environmentalHealth: 0,
        },
      });
    });

    // Start the learning cycle
    setInterval(() => this.evolveCity(), 24 * 60 * 60 * 1000); // Daily adaptation cycle
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.cityService.on("metricsUpdated", this.handleMetricsUpdate.bind(this));
    this.metricsService.on("alert", this.handleMetricsAlert.bind(this));
    this.districtService.on(
      "districtEvent",
      this.handleDistrictEvent.bind(this)
    );
    this.agentConversationService.on(
      "conversationEnded",
      this.handleConversation.bind(this)
    );
    this.socialDynamicsService.on(
      "socialPatternDetected",
      this.handleSocialPattern.bind(this)
    );
  }

  private async handleMetricsUpdate(metrics: CityMetrics) {
    try {
      // Process metrics into learning patterns
      const patterns = this.extractPatternsFromMetrics(metrics);

      // Update learning history
      patterns.forEach((pattern) => {
        const domain = this.identifyEventDomain(pattern);
        if (!this.learningHistory.has(domain)) {
          this.learningHistory.set(domain, []);
        }
        this.learningHistory.get(domain)?.push({
          timestamp: Date.now(),
          pattern,
          metrics: _.cloneDeep(metrics),
        });
      });

      // Trigger adaptations if needed
      if (this.shouldTriggerAdaptation(patterns)) {
        await this.evolveCity();
      }

      this.emit("learningUpdated", { patterns, timestamp: Date.now() });
    } catch (error) {
      console.error("Error handling metrics update:", error);
    }
  }

  private async handleMetricsAlert(alert: any) {
    try {
      // Process alert into adaptation opportunity
      const opportunity = this.convertAlertToOpportunity(alert);

      // Update affected districts
      if (alert.districtId) {
        const districtData = this.districtLearning.get(alert.districtId);
        if (districtData) {
          districtData.patterns.push({
            type: alert.type,
            success: false,
            impact: alert.severity || 0.5,
          });
        }
      }

      // Trigger immediate adaptation if severe
      if (alert.severity > 0.8) {
        const adaptation = await this.generateEmergencyAdaptation(alert);
        await this.implementAdaptations(adaptation);
      }

      this.emit("alertProcessed", {
        alert,
        opportunity,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error handling metrics alert:", error);
    }
  }

  private async handleDistrictEvent(event: DistrictEvent) {
    try {
      const districtData = this.districtLearning.get(event.districtId);
      if (!districtData) return;

      // Update district learning patterns
      districtData.patterns.push({
        type: event.type,
        success: event.success || true,
        impact: event.impact || 0.5,
      });

      // Update district metrics
      if (event.metrics) {
        districtData.metrics = {
          ...districtData.metrics,
          ...event.metrics,
        };
      }

      // Generate district-specific adaptations if needed
      if (this.shouldAdaptDistrict(districtData)) {
        const adaptations = await this.generateDistrictAdaptations(
          event.districtId
        );
        await this.implementDistrictAdaptations(event.districtId, adaptations);
      }

      this.emit("districtLearningUpdated", {
        districtId: event.districtId,
        patterns: districtData.patterns,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error handling district event:", error);
    }
  }

  private async handleConversation(event: ConversationEvent) {
    try {
      // Extract learning patterns from conversation
      const patterns = this.extractConversationPatterns(event);

      // Update district learning if conversation is district-specific
      if (event.districtId) {
        const districtData = this.districtLearning.get(event.districtId);
        if (districtData) {
          patterns.forEach((pattern) => {
            districtData.patterns.push({
              type: "conversation",
              success: pattern.success,
              impact: pattern.impact,
            });
          });
        }
      }

      // Update social patterns
      this.updateSocialPatterns(event);

      this.emit("conversationLearningUpdated", {
        patterns,
        districtId: event.districtId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error handling conversation:", error);
    }
  }

  private async handleSocialPattern(pattern: SocialPattern) {
    try {
      // Store social pattern
      const patternKey = pattern.type;
      if (!this.socialPatterns.has(patternKey)) {
        this.socialPatterns.set(patternKey, []);
      }
      this.socialPatterns.get(patternKey)?.push(pattern);

      // Update affected districts
      if (pattern.districtId) {
        const districtData = this.districtLearning.get(pattern.districtId);
        if (districtData) {
          districtData.patterns.push({
            type: "social",
            success: pattern.impact > 0,
            impact: Math.abs(pattern.impact),
          });
        }
      }

      // Generate social adaptations if needed
      if (this.shouldAdaptSocialPatterns(patternKey)) {
        const adaptations = await this.generateSocialAdaptations(pattern);
        await this.implementSocialAdaptations(adaptations);
      }

      this.emit("socialPatternLearningUpdated", {
        pattern,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error handling social pattern:", error);
    }
  }

  private extractPatternsFromMetrics(metrics: CityMetrics): any[] {
    // Implementation of pattern extraction from metrics
    const patterns = [];
    for (const [domain, values] of Object.entries(metrics)) {
      for (const [metric, value] of Object.entries(values)) {
        if (typeof value === "number") {
          patterns.push({
            domain,
            metric,
            value,
            timestamp: Date.now(),
          });
        }
      }
    }
    return patterns;
  }

  private shouldTriggerAdaptation(patterns: any[]): boolean {
    return patterns.some((p) => Math.abs(p.value - 0.5) > 0.3);
  }

  private convertAlertToOpportunity(alert: any) {
    return {
      area: alert.type,
      potential: alert.severity,
      cost: this.estimateImprovementCost(alert.type, "alert", alert.severity),
    };
  }

  private async generateEmergencyAdaptation(
    alert: any
  ): Promise<AdaptationPlan> {
    return {
      infrastructureChanges: [
        {
          type: "upgrade",
          target: alert.type,
          priority: 1,
          estimatedImpact: 0.9,
          cost: this.estimateUpgradeCost(alert.type),
        },
      ],
      serviceImprovements: [],
      newFeatures: [],
    };
  }

  private shouldAdaptDistrict(data: DistrictLearningData): boolean {
    const recentPatterns = data.patterns.filter(
      (p) => p.impact > this.config.impactThreshold
    );
    return recentPatterns.length >= 3;
  }

  private async generateDistrictAdaptations(
    districtId: string
  ): Promise<AdaptationPlan> {
    const districtData = this.districtLearning.get(districtId);
    if (!districtData)
      throw new Error(`No learning data for district ${districtId}`);

    return {
      infrastructureChanges:
        this.generateDistrictInfrastructureChanges(districtData),
      serviceImprovements:
        this.generateDistrictServiceImprovements(districtData),
      newFeatures: this.generateDistrictFeatures(districtData),
    };
  }

  private generateDistrictInfrastructureChanges(data: DistrictLearningData) {
    return data.patterns
      .filter((p) => p.impact > this.config.impactThreshold)
      .map((p) => ({
        type: "upgrade" as const,
        target: p.type,
        priority: p.impact,
        estimatedImpact: p.impact,
        cost: this.estimateUpgradeCost(p.type),
      }));
  }

  private generateDistrictServiceImprovements(data: DistrictLearningData) {
    return data.patterns
      .filter((p) => p.type.includes("service"))
      .map((p) => ({
        service: p.type,
        changes: [`Improve ${p.type} based on pattern`],
        expectedBenefit: p.impact,
        implementation: `Implement improvements for ${p.type}`,
      }));
  }

  private generateDistrictFeatures(data: DistrictLearningData) {
    return data.patterns
      .filter((p) => p.success && p.impact > 0.8)
      .map((p) => ({
        name: `Enhanced ${p.type}`,
        description: `New feature based on successful pattern in ${p.type}`,
        requirements: this.identifyFeatureRequirements(p.type),
        impact: p.impact,
      }));
  }

  private extractConversationPatterns(event: ConversationEvent) {
    return [
      {
        success: event.sentiment > 0.5,
        impact: Math.abs(event.sentiment - 0.5) * 2,
        type: event.topic || "general",
      },
    ];
  }

  private updateSocialPatterns(event: ConversationEvent) {
    if (!event.topic) return;

    const patterns = this.socialPatterns.get(event.topic) || [];
    patterns.push({
      type: event.topic,
      impact: event.sentiment,
      timestamp: Date.now(),
      districtId: event.districtId,
    });
    this.socialPatterns.set(event.topic, patterns);
  }

  private shouldAdaptSocialPatterns(patternKey: string): boolean {
    const patterns = this.socialPatterns.get(patternKey) || [];
    const recentPatterns = patterns.filter(
      (p) => p.timestamp > Date.now() - this.config.analysisWindow
    );
    return recentPatterns.length >= 5;
  }

  private async generateSocialAdaptations(
    pattern: SocialPattern
  ): Promise<AdaptationPlan> {
    return {
      infrastructureChanges: [],
      serviceImprovements: [
        {
          service: "social",
          changes: [`Adapt to ${pattern.type} pattern`],
          expectedBenefit: Math.abs(pattern.impact),
          implementation: `Implement social adaptations for ${pattern.type}`,
        },
      ],
      newFeatures: [],
    };
  }

  private async implementDistrictAdaptations(
    districtId: string,
    adaptations: AdaptationPlan
  ) {
    const districtData = this.districtLearning.get(districtId);
    if (!districtData) return;

    // Update district adaptations
    districtData.adaptations = adaptations;

    // Store in vector store
    await this.vectorStore.upsert({
      id: `district-adaptation-${districtId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `District ${districtId} adaptations: ${JSON.stringify(adaptations)}`
      ),
      metadata: {
        type: "district",
        subtype: "adaptation",
        districtId,
        timestamp: Date.now(),
      },
    });

    this.emit("districtAdaptationsImplemented", {
      districtId,
      adaptations,
      timestamp: Date.now(),
    });
  }

  private async implementSocialAdaptations(adaptations: AdaptationPlan) {
    // Store in vector store
    await this.vectorStore.upsert({
      id: `social-adaptation-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Social adaptations: ${JSON.stringify(adaptations)}`
      ),
      metadata: {
        type: "social",
        subtype: "adaptation",
        timestamp: Date.now(),
      },
    });

    this.emit("socialAdaptationsImplemented", {
      adaptations,
      timestamp: Date.now(),
    });
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

  private async evolveCity(): Promise<void> {
    const cityData = await this.collectCityData();
    const adaptations = await this.generateAdaptations(cityData);
    await this.implementAdaptations(adaptations);
    this.lastEvolutionTimestamp = Date.now();
    this.emit("cityEvolved", { timestamp: Date.now() });
  }

  private async collectCityData(): Promise<CityLearningData> {
    return {
      successPatterns: await this.analyzeSuccessfulInteractions(),
      failurePoints: this.analyzeFailurePoints(),
      emergingNeeds: this.identifyEmergingNeeds(),
      adaptationOpportunities: this.identifyAdaptationOpportunities(),
      districtLearning: this.districtLearning,
      socialPatterns: Array.from(this.socialPatterns.entries()).map(
        ([type, patterns]) => ({
          pattern: patterns[patterns.length - 1],
          frequency: patterns.length,
          impact:
            patterns.reduce((sum, p) => sum + p.impact, 0) / patterns.length,
        })
      ),
    };
  }

  private async analyzeSuccessfulInteractions(): Promise<
    Array<{ pattern: string; impact: number; replicability: number }>
  > {
    const patterns: Array<{
      pattern: string;
      impact: number;
      replicability: number;
    }> = [];
    for (const [domain, events] of this.learningHistory.entries()) {
      const successfulEvents = events.filter((e) => e.success);
      if (successfulEvents.length > 0) {
        patterns.push({
          pattern: domain,
          impact:
            successfulEvents.reduce((sum, e) => sum + (e.impact || 0), 0) /
            successfulEvents.length,
          replicability: successfulEvents.length / events.length,
        });
      }
    }
    return patterns;
  }

  private analyzeFailurePoints(): Array<{
    issue: string;
    frequency: number;
    severity: number;
  }> {
    const failures: Array<{
      issue: string;
      frequency: number;
      severity: number;
    }> = [];
    for (const [domain, events] of this.learningHistory.entries()) {
      const failedEvents = events.filter((e) => !e.success);
      if (failedEvents.length > 0) {
        failures.push({
          issue: domain,
          frequency: this.calculateIssueFrequency(domain),
          severity:
            failedEvents.reduce((sum, e) => sum + (e.severity || 0), 0) /
            failedEvents.length,
        });
      }
    }
    return failures;
  }

  private identifyEmergingNeeds(): string[] {
    const needs: string[] = [];
    for (const [domain, events] of this.learningHistory.entries()) {
      const recentEvents = events.filter(
        (e) => e.timestamp > Date.now() - this.config.analysisWindow
      );
      if (recentEvents.length >= 5) {
        needs.push(domain);
      }
    }
    return needs;
  }

  private identifyAdaptationOpportunities(): Array<{
    area: string;
    potential: number;
    cost: number;
  }> {
    const opportunities: Array<{
      area: string;
      potential: number;
      cost: number;
    }> = [];
    for (const [domain, events] of this.learningHistory.entries()) {
      const recentEvents = events.filter(
        (e) => e.timestamp > Date.now() - this.config.analysisWindow
      );
      if (recentEvents.length > 0) {
        const potential =
          recentEvents.reduce((sum, e) => sum + (e.impact || 0), 0) /
          recentEvents.length;
        opportunities.push({
          area: domain,
          potential,
          cost: this.estimateImprovementCost(domain, "adaptation", potential),
        });
      }
    }
    return opportunities;
  }

  private async generateAdaptations(
    data: CityLearningData
  ): Promise<AdaptationPlan> {
    return {
      infrastructureChanges: this.generateInfrastructureChanges(data),
      serviceImprovements: this.generateServiceImprovements(data),
      newFeatures: this.generateNewFeatures(data),
    };
  }

  private generateInfrastructureChanges(data: CityLearningData) {
    return data.adaptationOpportunities
      .filter((opp) => opp.potential > this.config.impactThreshold)
      .map((opp) => ({
        type: "upgrade" as const,
        target: opp.area,
        priority: opp.potential,
        estimatedImpact: opp.potential,
        cost: opp.cost,
      }));
  }

  private generateServiceImprovements(data: CityLearningData) {
    return data.failurePoints
      .filter((point) => point.severity > this.config.impactThreshold)
      .map((point) => ({
        service: this.extractServiceFromIssue(point.issue),
        changes: [`Address ${point.issue}`],
        expectedBenefit: 1 - point.severity,
        implementation: `Implement fixes for ${point.issue}`,
      }));
  }

  private generateNewFeatures(data: CityLearningData) {
    return data.emergingNeeds.map((need) => ({
      name: this.generateFeatureName(need),
      description: this.generateFeatureDescription(need),
      requirements: this.identifyFeatureRequirements(need),
      impact: this.estimateFeatureImpact(need),
    }));
  }

  private async implementAdaptations(plan: AdaptationPlan): Promise<void> {
    // Store in vector store
    await this.vectorStore.upsert({
      id: `adaptation-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(JSON.stringify(plan)),
      metadata: {
        type: "adaptation",
        timestamp: Date.now(),
      },
    });

    this.emit("adaptationsImplemented", {
      plan,
      timestamp: Date.now(),
    });
  }
}
