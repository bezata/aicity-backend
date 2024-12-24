import { EventEmitter } from "events";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

interface TopicTrend {
  topic: string;
  frequency: number;
  sentiment: number;
  momentum?: number; // Rate of change in frequency
  peakTime?: number; // Timestamp of highest frequency
}

interface InteractionStats {
  agentId: string;
  totalInteractions: number;
  averageSentiment: number;
  topTopics: string[];
  responseTime?: number;
  effectivenessScore?: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  peakLoadTimestamp: number;
  activeAgents: number;
  resourceUtilization: number;
}

export class AnalyticsService extends EventEmitter {
  private topicTrends: Map<string, TopicTrend> = new Map();
  private interactionStats: Map<string, InteractionStats> = new Map();
  private moodHistory: Array<{ timestamp: number; mood: number }> = [];
  private activeAgentTimestamps: Map<string, number> = new Map();
  private readonly ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private performanceMetrics: PerformanceMetrics = {
    averageResponseTime: 0,
    peakLoadTimestamp: 0,
    activeAgents: 0,
    resourceUtilization: 0,
  };

  constructor() {
    super();
    this.startActivityMonitoring();
  }

  private startActivityMonitoring() {
    setInterval(() => this.updateActiveAgents(), 60 * 1000); // Check every minute
  }

  private updateActiveAgents() {
    const now = Date.now();
    let activeCount = 0;

    this.activeAgentTimestamps.forEach((timestamp, agentId) => {
      if (now - timestamp <= this.ACTIVITY_TIMEOUT) {
        activeCount++;
      } else {
        this.activeAgentTimestamps.delete(agentId);
      }
    });

    this.performanceMetrics.activeAgents = activeCount;
    this.emit("activeAgentsUpdated", activeCount);
  }

  trackAgentActivity(agentId: string) {
    this.activeAgentTimestamps.set(agentId, Date.now());
    this.updateActiveAgents();
  }

  trackInteraction(agent: Agent, message: Message) {
    this.trackAgentActivity(agent.id);

    const startTime = Date.now();
    const stats = this.interactionStats.get(agent.id) || {
      agentId: agent.id,
      totalInteractions: 0,
      averageSentiment: 0,
      topTopics: [],
      responseTime: 0,
      effectivenessScore: 0,
    };

    stats.totalInteractions++;
    if (message.sentiment !== undefined) {
      stats.averageSentiment =
        (stats.averageSentiment * (stats.totalInteractions - 1) +
          message.sentiment) /
        stats.totalInteractions;
    }

    if (message.topics) {
      this.updateTopicTrends(message.topics, message.sentiment);
      this.updateAgentTopics(stats, message.topics);
    }

    // Update response time metrics
    const responseTime = Date.now() - startTime;
    stats.responseTime = stats.responseTime
      ? (stats.responseTime + responseTime) / 2
      : responseTime;

    // Calculate effectiveness score based on sentiment and response time
    stats.effectivenessScore = this.calculateEffectivenessScore(
      stats.averageSentiment,
      stats.responseTime
    );

    this.interactionStats.set(agent.id, stats);
    this.updatePerformanceMetrics(responseTime);
  }

  async getTopicTrends(): Promise<TopicTrend[]> {
    return Array.from(this.topicTrends.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  async getInteractionStats(): Promise<InteractionStats[]> {
    return Array.from(this.interactionStats.values());
  }

  async getMoodHistory(): Promise<Array<{ timestamp: number; mood: number }>> {
    return this.moodHistory.slice(-100); // Return last 100 mood records
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.performanceMetrics;
  }

  private updateTopicTrends(topics: string[], sentiment?: number) {
    const timestamp = Date.now();
    topics.forEach((topic) => {
      const trend = this.topicTrends.get(topic) || {
        topic,
        frequency: 0,
        sentiment: 0,
        momentum: 0,
        peakTime: timestamp,
      };

      const oldFrequency = trend.frequency;
      trend.frequency++;

      if (sentiment) {
        trend.sentiment =
          (trend.sentiment * oldFrequency + sentiment) / trend.frequency;
      }

      // Update momentum (rate of change in frequency)
      trend.momentum =
        (trend.frequency - oldFrequency) /
        (timestamp - (trend.peakTime || timestamp));

      // Update peak time if this is the highest frequency
      if (trend.frequency > oldFrequency) {
        trend.peakTime = timestamp;
      }

      this.topicTrends.set(topic, trend);
    });
  }

  private updateAgentTopics(stats: InteractionStats, topics: string[]) {
    const topicFrequencies = new Map<string, number>();
    topics.forEach((topic) => {
      topicFrequencies.set(topic, (topicFrequencies.get(topic) || 0) + 1);
    });
    stats.topTopics = Array.from(topicFrequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private calculateEffectivenessScore(
    sentiment: number,
    responseTime: number
  ): number {
    // Normalize response time (assuming 5000ms as baseline)
    const normalizedTime = Math.min(1, 5000 / responseTime);
    // Weight sentiment more heavily than response time
    return sentiment * 0.7 + normalizedTime * 0.3;
  }

  private updatePerformanceMetrics(responseTime: number) {
    const timestamp = Date.now();
    this.performanceMetrics.averageResponseTime =
      (this.performanceMetrics.averageResponseTime + responseTime) / 2;

    // Update peak load if current load is higher
    const currentLoad = this.interactionStats.size;
    if (currentLoad > this.performanceMetrics.activeAgents) {
      this.performanceMetrics.peakLoadTimestamp = timestamp;
      this.performanceMetrics.activeAgents = currentLoad;
    }

    // Calculate resource utilization (simplified)
    this.performanceMetrics.resourceUtilization =
      (currentLoad / 100) * // Assuming max capacity of 100 agents
      (this.performanceMetrics.averageResponseTime / 5000); // Normalized by 5000ms baseline
  }

  trackMood(mood: number) {
    this.moodHistory.push({
      timestamp: Date.now(),
      mood,
    });

    // Keep only last 1000 mood records
    if (this.moodHistory.length > 1000) {
      this.moodHistory.shift();
    }

    this.analyzeMoodTrends();
  }

  private analyzeMoodTrends() {
    if (this.moodHistory.length < 2) return;

    const recentMoods = this.moodHistory.slice(-10);
    const moodTrend =
      recentMoods.reduce((acc, curr, idx, arr) => {
        if (idx === 0) return acc;
        return acc + (curr.mood - arr[idx - 1].mood);
      }, 0) /
      (recentMoods.length - 1);

    if (Math.abs(moodTrend) > 0.1) {
      this.emit("significantMoodChange", {
        trend: moodTrend,
        timestamp: Date.now(),
        recentMood: recentMoods[recentMoods.length - 1].mood,
      });
    }
  }

  // Aggregation methods
  async getAggregatedStats(timeframe: "hour" | "day" | "week"): Promise<any> {
    const now = Date.now();
    const timeframes = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    };

    const threshold = now - timeframes[timeframe];
    const relevantMoods = this.moodHistory.filter(
      (m) => m.timestamp > threshold
    );

    return {
      averageMood:
        relevantMoods.reduce((acc, curr) => acc + curr.mood, 0) /
        relevantMoods.length,
      topTrends: await this.getTopicTrends(),
      activeAgents: this.performanceMetrics.activeAgents,
      systemPerformance: {
        responseTime: this.performanceMetrics.averageResponseTime,
        utilization: this.performanceMetrics.resourceUtilization,
      },
    };
  }

  trackEvent(eventName: string, data: Record<string, any>) {
    // Implementation
  }
}
