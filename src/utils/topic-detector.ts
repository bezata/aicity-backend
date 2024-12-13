import type { Message } from "../types/conversation.types";

export class TopicDetector {
  private commonWords = new Set([
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

  private topicPatterns = new Map([
    [
      "technology",
      /\b(tech|computer|software|hardware|ai|digital|code|programming|internet)\b/i,
    ],
    [
      "science",
      /\b(science|physics|chemistry|biology|research|experiment|theory|scientific)\b/i,
    ],
    [
      "philosophy",
      /\b(philosophy|existence|consciousness|reality|truth|meaning|ethics|moral)\b/i,
    ],
    [
      "nature",
      /\b(nature|environment|climate|weather|ecosystem|planet|earth|natural)\b/i,
    ],
    [
      "arts",
      /\b(art|music|literature|poetry|creative|artistic|culture|design)\b/i,
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

    // Keyword-based detection
    words.forEach((word) => {
      if (this.isSignificantTerm(word)) {
        topics.add(word);
      }
    });

    return topics;
  }

  private isSignificantTerm(word: string): boolean {
    // Check if word is likely to be a meaningful topic
    return (
      word.length > 4 && !this.commonWords.has(word) && !/^\d+$/.test(word)
    );
  }
}
