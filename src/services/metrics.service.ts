import { EventEmitter } from "events";
import { CityMetrics } from "../types/city-metrics";
import { VectorStoreService } from "./vector-store.service";
import { EnvironmentService } from "./environment.service";

interface AIMetrics {
  agentActivity: {
    activeAgents: number;
    averageResponseTime: number;
    interactionQuality: number;
    taskCompletionRate: number;
    learningProgress: number;
  };
  computationalResources: {
    cpuUtilization: number;
    memoryUsage: number;
    networkBandwidth: number;
    storageCapacity: number;
    processingLatency: number;
  };
  aiServices: {
    availabilityRate: number;
    accuracyScore: number;
    adaptabilityIndex: number;
    innovationRate: number;
    userSatisfaction: number;
  };
  dataMetrics: {
    dataQuality: number;
    dataProcessingRate: number;
    insightGeneration: number;
    predictionAccuracy: number;
    anomalyDetection: number;
  };
  aiSafety: {
    securityScore: number;
    biasRating: number;
    ethicsCompliance: number;
    privacyProtection: number;
    systemReliability: number;
  };
}

interface EnhancedCityMetrics extends CityMetrics {
  ai: AIMetrics;
}

type VectorStoreType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport";

export class MetricsService extends EventEmitter {
  private currentMetrics: EnhancedCityMetrics;
  private metricsHistory: Array<{
    timestamp: number;
    metrics: EnhancedCityMetrics;
  }> = [];

  constructor(
    private vectorStore: VectorStoreService,
    private environmentService?: EnvironmentService
  ) {
    super();
    this.currentMetrics = this.initializeMetrics();
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    // Monitor AI metrics every minute
    setInterval(() => this.monitorAIMetrics(), 60 * 1000);
    // Analyze AI performance every 5 minutes
    setInterval(() => this.analyzeAIPerformance(), 5 * 60 * 1000);
    // Update AI safety metrics every 15 minutes
    setInterval(() => this.updateAISafetyMetrics(), 15 * 60 * 1000);
  }

  private async monitorAIMetrics() {
    const aiMetrics = await this.gatherAIMetrics();
    await this.updateMetrics({ ai: aiMetrics });
  }

  private async analyzeAIPerformance() {
    const performance = await this.calculateAIPerformance();
    if (performance.bottlenecks.length > 0) {
      this.emit("aiOptimizationNeeded", performance.optimizationSuggestions);
    }
    return performance;
  }

  private async updateAISafetyMetrics() {
    const safetyMetrics = await this.assessAISafety();
    if (safetyMetrics.hasIssues) {
      this.emit("aiSafetyAlert", safetyMetrics.issues);
    }
  }

  async updateMetrics(updates: Partial<EnhancedCityMetrics>) {
    this.currentMetrics = {
      ...this.currentMetrics,
      ...updates,
    };

    // Store in vector DB for historical analysis
    await this.vectorStore.upsert({
      id: `metrics-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(JSON.stringify(updates)),
      metadata: {
        type: "district" as VectorStoreType,
        timestamp: Date.now(),
        metrics: JSON.stringify(updates),
      },
    });

    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics: this.currentMetrics,
    });

    // Keep history manageable
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }

    this.emit("metricsUpdated", this.currentMetrics);
  }

  async getMetricsAnalysis(): Promise<{
    current: EnhancedCityMetrics;
    trends: {
      improving: string[];
      declining: string[];
      stable: string[];
    };
    recommendations: string[];
    aiInsights: {
      performance: {
        score: number;
        bottlenecks: string[];
        optimizationSuggestions: string[];
      };
      safety: {
        score: number;
        risks: string[];
        mitigationStrategies: string[];
      };
      innovation: {
        score: number;
        opportunities: string[];
        researchDirections: string[];
      };
    };
  }> {
    return {
      current: this.currentMetrics,
      trends: this.analyzeTrends(),
      recommendations: await this.generateRecommendations(),
      aiInsights: await this.generateAIInsights(),
    };
  }

  private async generateAIInsights() {
    const performance = await this.analyzeAIPerformance();
    const safety = await this.assessAISafety();
    const innovation = await this.evaluateAIInnovation();

    return {
      performance,
      safety,
      innovation,
    };
  }

  private async gatherAIMetrics(): Promise<AIMetrics> {
    // Implementation would gather real metrics from various AI systems
    return {
      agentActivity: {
        activeAgents: 0,
        averageResponseTime: 0,
        interactionQuality: 0,
        taskCompletionRate: 0,
        learningProgress: 0,
      },
      computationalResources: {
        cpuUtilization: 0,
        memoryUsage: 0,
        networkBandwidth: 0,
        storageCapacity: 0,
        processingLatency: 0,
      },
      aiServices: {
        availabilityRate: 0,
        accuracyScore: 0,
        adaptabilityIndex: 0,
        innovationRate: 0,
        userSatisfaction: 0,
      },
      dataMetrics: {
        dataQuality: 0,
        dataProcessingRate: 0,
        insightGeneration: 0,
        predictionAccuracy: 0,
        anomalyDetection: 0,
      },
      aiSafety: {
        securityScore: 0,
        biasRating: 0,
        ethicsCompliance: 0,
        privacyProtection: 0,
        systemReliability: 0,
      },
    };
  }

  private async calculateAIPerformance() {
    const metrics = this.currentMetrics.ai;
    const bottlenecks = this.identifyBottlenecks(metrics);
    const optimizationSuggestions = await this.generateOptimizationSuggestions(
      bottlenecks
    );

    return {
      score: this.calculatePerformanceScore(metrics),
      bottlenecks,
      optimizationSuggestions,
    };
  }

  private async assessAISafety() {
    const metrics = this.currentMetrics.ai.aiSafety;
    const risks = this.identifySafetyRisks(metrics);
    const mitigationStrategies = await this.generateMitigationStrategies(risks);

    return {
      score: this.calculateSafetyScore(metrics),
      hasIssues: risks.length > 0,
      issues: risks,
      risks,
      mitigationStrategies,
    };
  }

  private async evaluateAIInnovation() {
    const metrics = this.currentMetrics.ai;
    const opportunities = await this.identifyInnovationOpportunities(metrics);
    const researchDirections = await this.suggestResearchDirections(
      opportunities
    );

    return {
      score: this.calculateInnovationScore(metrics),
      opportunities,
      researchDirections,
    };
  }

  private identifyBottlenecks(metrics: AIMetrics): string[] {
    const bottlenecks: string[] = [];

    if (metrics.computationalResources.cpuUtilization > 0.8) {
      bottlenecks.push("High CPU utilization");
    }
    if (metrics.computationalResources.memoryUsage > 0.8) {
      bottlenecks.push("High memory usage");
    }
    if (metrics.agentActivity.averageResponseTime > 2000) {
      bottlenecks.push("High response time");
    }
    if (metrics.aiServices.accuracyScore < 0.8) {
      bottlenecks.push("Low accuracy score");
    }

    return bottlenecks;
  }

  private async generateOptimizationSuggestions(
    bottlenecks: string[]
  ): Promise<string[]> {
    // Query vector store for past solutions to similar bottlenecks
    const suggestions: string[] = [];
    for (const bottleneck of bottlenecks) {
      const query = await this.vectorStore.query({
        vector: await this.vectorStore.createEmbedding(
          `optimization solutions for ${bottleneck}`
        ),
        filter: {
          type: { $eq: "optimization" },
        },
        topK: 1,
      });

      if (query.matches.length > 0) {
        suggestions.push(query.matches[0].metadata.solution as string);
      }
    }
    return suggestions;
  }

  private identifySafetyRisks(metrics: AIMetrics["aiSafety"]): string[] {
    const risks: string[] = [];

    if (metrics.securityScore < 0.7) {
      risks.push("Security vulnerabilities detected");
    }
    if (metrics.biasRating > 0.3) {
      risks.push("Significant bias detected");
    }
    if (metrics.ethicsCompliance < 0.9) {
      risks.push("Ethics compliance issues");
    }
    if (metrics.privacyProtection < 0.8) {
      risks.push("Privacy protection concerns");
    }

    return risks;
  }

  private async generateMitigationStrategies(
    risks: string[]
  ): Promise<string[]> {
    // Query vector store for proven mitigation strategies
    const strategies: string[] = [];
    for (const risk of risks) {
      const query = await this.vectorStore.query({
        vector: await this.vectorStore.createEmbedding(
          `mitigation strategies for ${risk}`
        ),
        filter: {
          type: { $eq: "mitigation" },
        },
        topK: 1,
      });

      if (query.matches.length > 0) {
        strategies.push(query.matches[0].metadata.strategy as string);
      }
    }
    return strategies;
  }

  private async identifyInnovationOpportunities(
    metrics: AIMetrics
  ): Promise<string[]> {
    const opportunities: string[] = [];

    if (metrics.aiServices.adaptabilityIndex > 0.8) {
      opportunities.push("High adaptability enables new service types");
    }
    if (metrics.dataMetrics.insightGeneration > 0.7) {
      opportunities.push("Strong insight generation capabilities");
    }
    if (metrics.agentActivity.learningProgress > 0.8) {
      opportunities.push("Advanced learning capabilities");
    }

    return opportunities;
  }

  private async suggestResearchDirections(
    opportunities: string[]
  ): Promise<string[]> {
    // Query vector store for research directions related to opportunities
    const directions: string[] = [];
    for (const opportunity of opportunities) {
      const query = await this.vectorStore.query({
        vector: await this.vectorStore.createEmbedding(
          `research directions for ${opportunity}`
        ),
        filter: {
          type: { $eq: "research" },
        },
        topK: 1,
      });

      if (query.matches.length > 0) {
        directions.push(query.matches[0].metadata.direction as string);
      }
    }
    return directions;
  }

  private calculatePerformanceScore(metrics: AIMetrics): number {
    return (
      metrics.agentActivity.taskCompletionRate * 0.3 +
      metrics.aiServices.accuracyScore * 0.3 +
      metrics.dataMetrics.predictionAccuracy * 0.2 +
      (1 - metrics.computationalResources.processingLatency / 1000) * 0.2
    );
  }

  private calculateSafetyScore(metrics: AIMetrics["aiSafety"]): number {
    return (
      metrics.securityScore * 0.25 +
      (1 - metrics.biasRating) * 0.25 +
      metrics.ethicsCompliance * 0.25 +
      metrics.privacyProtection * 0.25
    );
  }

  private calculateInnovationScore(metrics: AIMetrics): number {
    return (
      metrics.aiServices.innovationRate * 0.4 +
      metrics.aiServices.adaptabilityIndex * 0.3 +
      metrics.dataMetrics.insightGeneration * 0.3
    );
  }

  private initializeMetrics(): EnhancedCityMetrics {
    return {
      weather: {
        temperature: 22,
        feelsLike: 23,
        humidity: 65,
        precipitation: 0,
        windSpeed: 12,
        windDirection: "NE",
      },
      environmental: {
        airQuality: 85,
        noiseLevel: 45,
        waterQuality: 7,
        greenCoverage: 0.4,
        emissions: 0.5,
      },
      emergency: {
        level: "normal",
        activeIncidents: 2,
        responseTeamsAvailable: 8,
      },
      vitals: {
        populationCount: 15234,
        activeEntities: 12453,
        visitorCount: 892,
        peakHoursStatus: "Optimal",
      },
      community: {
        activeEvents: 12,
        ongoingMeetings: 5,
        collaborationSessions: 8,
        chatActivity: "High",
      },
      safety: {
        overallScore: 95,
        recentIncidents: 3,
        responseTime: "2.5 min",
        serviceAvailability: 98,
        crimeRate: 2.1,
        emergencyResponseTime: 8.5,
        publicTrustIndex: 0.7,
        disasterReadiness: 0.8,
      },
      resources: {
        energyConsumption: 72,
        waterUsage: 65,
        wasteManagement: 88,
        efficiency: 91,
      },
      transport: {
        trafficDensity: 45,
        publicTransportLoad: 68,
        parkingAvailable: 342,
        avgTransitTime: 15,
        trafficCongestion: 0.4,
        publicTransitReliability: 0.85,
      },
      economic: {
        businessActivity: 82,
        growthRate: 4.2,
        activeTransactions: 1243,
        marketSentiment: "Positive",
        employmentRate: 0.92,
        giniCoefficient: 0.35,
        businessFormationRate: 5.2,
        innovationIndex: 0.7,
        housingAffordability: 0.6,
      },
      cultural: {
        eventAttendance: 89,
        culturalSiteVisits: 1205,
        communityEngagement: 86,
        socialCohesion: 92,
        culturalEngagement: 3.5,
        civicParticipation: 0.65,
      },
      infrastructure: {
        maintenanceRequests: 23,
        serviceUptime: 99.9,
        healthScore: 94,
        developmentProgress: 78,
        wasteRecyclingRate: 0.6,
        smartGridEfficiency: 0.8,
      },
      budget: {
        currentStatus: 8500000,
        monthlySpending: 750000,
        efficiency: 92,
        allocation: {
          infrastructure: 35,
          services: 25,
          development: 20,
          emergency: 20,
        },
      },
      departments: {
        responseTimes: 95,
        serviceQuality: 89,
        resourceUtilization: 86,
        efficiency: 91,
      },
      donations: {
        activeCampaigns: 5,
        totalDonations: 2500000,
        goalProgress: 75,
        impactScore: 89,
      },
      sustainability: {
        carbonEmissions: 10,
        renewableEnergyRatio: 0.3,
        greenSpaceIndex: 0.4,
        airQualityIndex: 150,
        waterQualityScore: 0.8,
        biodiversityIndex: 0.6,
      },
      social: {
        healthcareAccessScore: 0.75,
        educationQualityIndex: 0.8,
        communityWellbeing: 0.7,
      },
      ai: {
        agentActivity: {
          activeAgents: 0,
          averageResponseTime: 0,
          interactionQuality: 0,
          taskCompletionRate: 0,
          learningProgress: 0,
        },
        computationalResources: {
          cpuUtilization: 0,
          memoryUsage: 0,
          networkBandwidth: 0,
          storageCapacity: 0,
          processingLatency: 0,
        },
        aiServices: {
          availabilityRate: 0,
          accuracyScore: 0,
          adaptabilityIndex: 0,
          innovationRate: 0,
          userSatisfaction: 0,
        },
        dataMetrics: {
          dataQuality: 0,
          dataProcessingRate: 0,
          insightGeneration: 0,
          predictionAccuracy: 0,
          anomalyDetection: 0,
        },
        aiSafety: {
          securityScore: 0,
          biasRating: 0,
          ethicsCompliance: 0,
          privacyProtection: 0,
          systemReliability: 0,
        },
      },
    };
  }

  private analyzeTrends() {
    const recentMetrics = this.metricsHistory.slice(-5); // Last 5 measurements
    const trends = {
      improving: [] as string[],
      declining: [] as string[],
      stable: [] as string[],
    };

    // Analyze each metric
    Object.entries(this.currentMetrics).forEach(([category, metrics]) => {
      Object.entries(metrics).forEach(([metric, currentValue]) => {
        const trend = this.calculateMetricTrend(
          category,
          metric,
          recentMetrics
        );
        trends[trend].push(`${category}.${metric}`);
      });
    });

    return trends;
  }

  private calculateMetricTrend(
    category: string,
    metric: string,
    history: Array<{ metrics: EnhancedCityMetrics }>
  ): "improving" | "declining" | "stable" {
    const values = history.map((h) => (h.metrics as any)[category][metric]);

    const change = this.calculateTrendChange(values);

    if (Math.abs(change) < 0.05) return "stable";
    return change > 0 ? "improving" : "declining";
  }

  private calculateTrendChange(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    return (last - first) / first;
  }

  private async generateRecommendations(): Promise<string[]> {
    const trends = this.analyzeTrends();
    const recommendations: string[] = [];

    // Generate recommendations based on declining metrics
    for (const metric of trends.declining) {
      const [category, name] = metric.split(".");
      const recommendation = await this.getRecommendationForMetric(
        category,
        name,
        (this.currentMetrics as any)[category][name]
      );
      recommendations.push(recommendation);
    }

    return recommendations;
  }

  private async getRecommendationForMetric(
    category: string,
    metric: string,
    value: number
  ): Promise<string> {
    // Query vector store for similar past situations and their solutions
    const query = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `${category} ${metric} improvement strategies`
      ),
      filter: {
        type: { $eq: "recommendation" },
      },
      topK: 1,
    });

    if (query.matches.length > 0) {
      return query.matches[0].metadata.recommendation as string;
    }

    // Fallback generic recommendations
    return `Consider reviewing and optimizing ${category} policies related to ${metric}`;
  }

  async getCurrentMetrics(districtId: string): Promise<any> {
    try {
      // Get environmental metrics if available
      let environmentalMetrics;
      if (this.environmentService) {
        const metrics = await this.environmentService.getEnvironmentalMetrics(
          districtId
        );
        if (metrics instanceof Map) {
          environmentalMetrics = metrics.get(districtId);
        } else {
          environmentalMetrics = metrics;
        }
      }

      // Query vector store for latest district metrics
      const results = await this.vectorStore.query({
        vector: await this.vectorStore.createEmbedding(
          `district ${districtId} current metrics`
        ),
        filter: {
          type: { $eq: "district" },
          districtId: { $eq: districtId },
        },
        topK: 1,
      });

      let metrics;
      if (results.matches?.length > 0 && results.matches[0].metadata?.metrics) {
        try {
          metrics = JSON.parse(results.matches[0].metadata.metrics);
        } catch (error) {
          console.error("Failed to parse metrics:", error);
          metrics = this.getDefaultMetrics();
        }
      } else {
        console.log("No metrics found for district, using defaults");
        metrics = this.getDefaultMetrics();
      }

      // Merge environmental metrics if available
      if (environmentalMetrics) {
        metrics.environmental = {
          airQuality: environmentalMetrics.airQuality.aqi,
          noiseLevel: environmentalMetrics.noiseLevel.decibels,
          waterQuality: environmentalMetrics.waterQuality.ph,
          greenCoverage: environmentalMetrics.greenCoverage,
        };
      }

      return metrics;
    } catch (error) {
      console.error("Error fetching metrics:", error);
      return this.getDefaultMetrics();
    }
  }

  private getDefaultMetrics() {
    return {
      safety: 0.7,
      cleanliness: 0.7,
      noise: 0.5,
      crowding: 0.5,
      ambiance: 0.7,
      education: 0.7,
      healthcare: 0.7,
      environment: 0.7,
      economicGrowth: 0.6,
      environmental: {
        airQuality: 75,
        noiseLevel: 45,
        waterQuality: 7.0,
        greenCoverage: 0.3,
      },
    };
  }
}
