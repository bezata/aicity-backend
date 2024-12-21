import type { Message } from "../types/conversation.types";

export class TopicDetector {
  private readonly commonWords = new Set([
    "the",
    "be",
    "to",
    "of",
    "and",
    "a",
    "in",
    "that",
    "have",
    "i",
    "it",
    "for",
    "not",
    "on",
    "with",
    "he",
    "as",
    "you",
    "do",
    "at",
  ]);

  private readonly topicPatterns = new Map([
    // City Infrastructure
    [
      "infrastructure",
      /\b(infrastructure|building|road|bridge|utility|construction|maintenance)\b/i,
    ],
    [
      "transport",
      /\b(transport|traffic|bus|train|subway|mobility|commute|transit)\b/i,
    ],
    [
      "utilities",
      /\b(power|electricity|water|energy|grid|utility|resource|supply)\b/i,
    ],

    // Urban Life
    [
      "community",
      /\b(community|neighborhood|resident|local|social|gathering|event)\b/i,
    ],
    [
      "culture",
      /\b(culture|art|music|festival|exhibition|performance|heritage)\b/i,
    ],
    [
      "services",
      /\b(service|healthcare|education|school|hospital|emergency|police|fire)\b/i,
    ],

    // Environment
    [
      "environment",
      /\b(environment|green|park|pollution|sustainability|climate|ecology)\b/i,
    ],
    [
      "weather",
      /\b(weather|temperature|rain|sun|wind|storm|forecast|climate)\b/i,
    ],

    // Development
    [
      "development",
      /\b(development|planning|project|initiative|improvement|innovation)\b/i,
    ],
    [
      "economy",
      /\b(economy|business|market|trade|finance|investment|growth)\b/i,
    ],

    // Smart City
    [
      "technology",
      /\b(technology|smart|digital|ai|automation|sensor|data|system)\b/i,
    ],
    [
      "safety",
      /\b(safety|security|emergency|protection|risk|monitoring|alert)\b/i,
    ],
  ]);

  async detectTopics(text: string): Promise<Set<string>> {
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3 && !this.commonWords.has(word));

    const topics = new Set<string>();

    // Pattern-based detection
    for (const [topic, pattern] of this.topicPatterns) {
      if (pattern.test(text)) {
        topics.add(topic);
      }
    }

    // Context-based grouping
    if (topics.has("transport") || topics.has("utilities")) {
      topics.add("infrastructure");
    }
    if (topics.has("technology") && topics.has("environment")) {
      topics.add("smart-sustainability");
    }

    // Add significant terms that might be specific locations or events
    words.forEach((word) => {
      if (this.isSignificantTerm(word)) {
        // Only add if it might be a proper noun or specific term
        if (word[0].toUpperCase() === word[0] || word.length > 6) {
          topics.add(word);
        }
      }
    });

    return topics;
  }

  private isSignificantTerm(word: string): boolean {
    return (
      word.length > 4 &&
      !this.commonWords.has(word) &&
      !/^\d+$/.test(word) &&
      !/^(https?:\/\/|www\.)/.test(word)
    ); // Exclude URLs
  }
}
