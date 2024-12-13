// src/utils/topic-detector.ts
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

// src/utils/style-manager.ts
import type { ConversationStyle } from "../types/common.types";
import type { ConversationState } from "../types/conversation.types";

export class StyleManager {
  private styleTransitions = new Map<ConversationStyle, ConversationStyle[]>([
    ["casual", ["playful", "philosophical"]],
    ["formal", ["serious", "philosophical"]],
    ["philosophical", ["formal", "casual"]],
    ["playful", ["casual", "philosophical"]],
    ["serious", ["formal", "philosophical"]],
  ]);

  private stylePrompts = new Map<ConversationStyle, string>([
    [
      "casual",
      `Keep the tone relaxed and friendly. Use:
- Informal language
- Occasional emojis
- Short, simple sentences
- Personal anecdotes when relevant`,
    ],

    [
      "formal",
      `Maintain a professional and structured tone. Use:
- Proper language and grammar
- Complete sentences
- Clear logical structure
- Professional terminology`,
    ],

    [
      "philosophical",
      `Engage in deep, thoughtful discussion. Use:
- Abstract concepts
- Reflective questions
- References to philosophical ideas
- Analytical thinking`,
    ],

    [
      "playful",
      `Keep things light and entertaining. Use:
- Humor and wordplay
- Playful expressions
- Light-hearted examples
- Fun analogies`,
    ],

    [
      "serious",
      `Focus on important matters clearly. Use:
- Direct language
- Clear points
- Relevant examples
- Factual information`,
    ],
  ]);

  getStylePrompt(style: ConversationStyle): string {
    return this.stylePrompts.get(style) || this.stylePrompts.get("casual")!;
  }

  suggestStyleTransition(
    currentStyle: ConversationStyle,
    state: ConversationState
  ): ConversationStyle | null {
    const possibleStyles = this.styleTransitions.get(currentStyle) || [];

    // Higher chance of transition when momentum is low
    if (state.momentum < 0.3 && Math.random() < 0.4) {
      return possibleStyles[Math.floor(Math.random() * possibleStyles.length)];
    }

    // Random transition with low probability
    if (Math.random() < 0.1) {
      return possibleStyles[Math.floor(Math.random() * possibleStyles.length)];
    }

    return null;
  }

  detectStyle(content: string): ConversationStyle {
    const stylePatterns = new Map<ConversationStyle, RegExp[]>([
      ["casual", [/\b(hey|hi|hello|lol|haha)\b/i, /😊|😄|🙂/]],
      ["formal", [/\b(furthermore|additionally|consequently|therefore)\b/i]],
      [
        "philosophical",
        [/\b(existence|consciousness|reality|truth|meaning)\b/i],
      ],
      ["playful", [/\b(fun|funny|joke|play|haha|wow)\b/i, /😆|😂|🤣/]],
      ["serious", [/\b(important|critical|significant|concern|issue)\b/i]],
    ]);

    const scores = new Map<ConversationStyle, number>();

    for (const [style, patterns] of stylePatterns) {
      const score = patterns.reduce(
        (acc, pattern) => acc + (pattern.test(content) ? 1 : 0),
        0
      );
      scores.set(style, score);
    }

    let maxScore = 0;
    let detectedStyle: ConversationStyle = "casual";

    for (const [style, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        detectedStyle = style;
      }
    }

    return detectedStyle;
  }
}
