import { EventEmitter } from "events";
import type { Agent } from "../types/agent.types";
import type { Message } from "../types/conversation.types";

interface TopicTrend {
  topic: string;
  frequency: number;
  sentiment: number;
}

interface InteractionStats {
  agentId: string;
  totalInteractions: number;
  averageSentiment: number;
  topTopics: string[];
}

export class AnalyticsService extends EventEmitter {
  private topicTrends: Map<string, TopicTrend> = new Map();
  private interactionStats: Map<string, InteractionStats> = new Map();
  private moodHistory: Array<{ timestamp: number; mood: number }> = [];

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

  trackInteraction(agent: Agent, message: Message) {
    const stats = this.interactionStats.get(agent.id) || {
      agentId: agent.id,
      totalInteractions: 0,
      averageSentiment: 0,
      topTopics: [],
    };

    stats.totalInteractions++;
    if (message.sentiment) {
      stats.averageSentiment =
        (stats.averageSentiment * (stats.totalInteractions - 1) +
          message.sentiment) /
        stats.totalInteractions;
    }

    if (message.topics) {
      message.topics.forEach((topic) => {
        const trend = this.topicTrends.get(topic) || {
          topic,
          frequency: 0,
          sentiment: 0,
        };
        trend.frequency++;
        if (message.sentiment) {
          trend.sentiment =
            (trend.sentiment * (trend.frequency - 1) + message.sentiment) /
            trend.frequency;
        }
        this.topicTrends.set(topic, trend);
      });

      // Update agent's top topics
      const topicFrequencies = new Map<string, number>();
      message.topics.forEach((topic) => {
        topicFrequencies.set(topic, (topicFrequencies.get(topic) || 0) + 1);
      });
      stats.topTopics = Array.from(topicFrequencies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);
    }

    this.interactionStats.set(agent.id, stats);
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
  }
}
