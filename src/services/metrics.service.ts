import { EventEmitter } from "events";
import { CityMetrics } from "../types/city-metrics";
import { VectorStoreService } from "./vector-store.service";

type VectorStoreType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport";

export class MetricsService extends EventEmitter {
  private currentMetrics: CityMetrics;
  private metricsHistory: Array<{
    timestamp: number;
    metrics: CityMetrics;
  }> = [];

  constructor(private vectorStore: VectorStoreService) {
    super();
    this.currentMetrics = this.initializeMetrics();
  }

  async updateMetrics(updates: Partial<CityMetrics>) {
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

    this.emit("metricsUpdated", this.currentMetrics);
  }

  async getMetricsAnalysis(): Promise<{
    current: CityMetrics;
    trends: {
      improving: string[];
      declining: string[];
      stable: string[];
    };
    recommendations: string[];
  }> {
    // Analyze trends and generate recommendations
    return {
      current: this.currentMetrics,
      trends: this.analyzeTrends(),
      recommendations: await this.generateRecommendations(),
    };
  }

  private initializeMetrics(): CityMetrics {
    return {
      sustainability: {
        carbonEmissions: 10,
        renewableEnergyRatio: 0.3,
        greenSpaceIndex: 0.4,
        airQualityIndex: 150,
        waterQualityScore: 0.8,
        biodiversityIndex: 0.6,
      },
      economy: {
        employmentRate: 0.92,
        giniCoefficient: 0.35,
        businessFormationRate: 5.2,
        innovationIndex: 0.7,
        housingAffordability: 0.6,
      },
      social: {
        healthcareAccessScore: 0.75,
        educationQualityIndex: 0.8,
        culturalEngagement: 3.5,
        civicParticipation: 0.65,
        communityWellbeing: 0.7,
      },
      infrastructure: {
        trafficCongestion: 0.4,
        publicTransitReliability: 0.85,
        wasteRecyclingRate: 0.6,
        infrastructureHealth: 0.75,
        smartGridEfficiency: 0.8,
      },
      safety: {
        crimeRate: 2.1,
        emergencyResponseTime: 8.5,
        publicTrustIndex: 0.7,
        disasterReadiness: 0.8,
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
    history: Array<{ metrics: CityMetrics }>
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
}
