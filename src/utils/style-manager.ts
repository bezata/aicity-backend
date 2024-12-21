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
  private readonly styleTransitions = new Map<
    ConversationStyle,
    ConversationStyle[]
  >([
    ["casual", ["playful", "empathetic", "adaptable"]],
    ["formal", ["technical", "precise", "methodical"]],
    ["technical", ["analytical", "precise", "educational"]],
    ["empathetic", ["supportive", "nurturing", "adaptable"]],
    ["analytical", ["technical", "precise", "investigative"]],
    ["visionary", ["innovative", "creative", "strategic"]],
    ["nurturing", ["supportive", "empathetic", "mentoring"]],
    ["precise", ["technical", "methodical", "analytical"]],
    ["playful", ["creative", "engaging", "adaptable"]],
    ["supportive", ["empathetic", "nurturing", "mentoring"]],
  ]);

  private readonly stylePrompts = new Map<ConversationStyle, string>([
    [
      "casual",
      `Keep the conversation friendly and approachable. Use:
- Conversational language
- Simple explanations
- Relatable examples
- Occasional emojis where appropriate`,
    ],
    [
      "formal",
      `Maintain a professional and structured approach. Use:
- Clear, precise language
- Technical terms when necessary
- Well-structured explanations
- Official terminology`,
    ],
    [
      "technical",
      `Focus on technical accuracy and detail. Use:
- Technical terminology
- Precise explanations
- Data-driven insights
- Structured information`,
    ],
    [
      "analytical",
      `Provide detailed analysis and insights. Use:
- Logical reasoning
- Data analysis
- Systematic approach
- Clear conclusions`,
    ],
    [
      "precise",
      `Maintain accuracy and clarity. Use:
- Exact terminology
- Clear definitions
- Specific examples
- Detailed explanations`,
    ],
    [
      "supportive",
      `Provide encouragement and guidance. Use:
- Positive reinforcement
- Helpful suggestions
- Patient explanations
- Constructive feedback`,
    ],
    [
      "empathetic",
      `Show understanding and support. Use:
- Acknowledging language
- Supportive phrases
- Understanding tone
- Active listening indicators`,
    ],
    [
      "playful",
      `Keep the tone light while being informative. Use:
- Friendly language
- Engaging examples
- Light humor when appropriate
- Creative explanations`,
    ],
    [
      "adaptable",
      `Adjust to the conversation flow naturally. Use:
- Flexible language
- Context-aware responses
- Appropriate formality
- Dynamic engagement`,
    ],
    [
      "strategic",
      `Focus on planning and outcomes. Use:
- Goal-oriented language
- Strategic thinking
- Clear objectives
- Action planning`,
    ],
    [
      "innovative",
      `Encourage creative solutions. Use:
- Novel approaches
- Creative thinking
- Fresh perspectives
- Innovative ideas`,
    ],
    [
      "methodical",
      `Follow a structured approach. Use:
- Step-by-step explanations
- Clear methodology
- Systematic process
- Organized thinking`,
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

    // Adapt style based on conversation state
    if (
      state.sentiment < 0.4 &&
      !["empathetic", "supportive", "nurturing"].includes(currentStyle)
    ) {
      return "empathetic";
    }

    if (state.topics.includes("emergency") || state.topics.includes("alert")) {
      return "precise";
    }

    if (
      state.topics.includes("technical") ||
      state.topics.includes("infrastructure")
    ) {
      return "technical";
    }

    // Style transition based on momentum and interaction count
    if (state.momentum < 0.3 && Math.random() < 0.4) {
      if (state.interactionCount > 10) {
        return "adaptable"; // Transition to adaptable after longer conversations
      }
      return possibleStyles[Math.floor(Math.random() * possibleStyles.length)];
    }

    // Random transition with low probability for variety
    if (Math.random() < 0.1) {
      return possibleStyles[Math.floor(Math.random() * possibleStyles.length)];
    }

    return null;
  }

  detectStyle(content: string): ConversationStyle {
    const stylePatterns = new Map<ConversationStyle, RegExp[]>([
      ["casual", [/\b(hey|hi|hello|thanks|great)\b/i, /😊|👋|🙂/]],
      ["formal", [/\b(regarding|accordingly|furthermore|therefore)\b/i]],
      ["technical", [/\b(specifically|according|data|analysis|system)\b/i]],
      ["analytical", [/\b(analyze|evaluate|assess|measure|compare)\b/i]],
      [
        "empathetic",
        [/\b(understand|feel|concern|worry|support)\b/i, /❤️|🤝|💪/],
      ],
      ["supportive", [/\b(help|assist|guide|encourage|improve)\b/i]],
      ["precise", [/\b(exactly|specifically|precisely|accurately|define)\b/i]],
      ["playful", [/\b(fun|awesome|cool|wow|amazing)\b/i, /😄|✨|🎉/]],
      ["adaptable", [/\b(adjust|flexible|adapt|change|flow)\b/i]],
      ["strategic", [/\b(plan|strategy|goal|objective|outcome)\b/i]],
      ["innovative", [/\b(new|creative|novel|unique|innovative)\b/i]],
      ["methodical", [/\b(step|process|method|systematic|organize)\b/i]],
    ]);

    const scores = new Map<ConversationStyle, number>();

    // Calculate style scores
    for (const [style, patterns] of stylePatterns) {
      const score = patterns.reduce(
        (acc, pattern) => acc + (pattern.test(content) ? 1 : 0),
        0
      );
      scores.set(style, score);
    }

    // Weight certain styles based on content characteristics
    if (content.includes("!")) {
      scores.set("playful", (scores.get("playful") || 0) + 0.5);
    }
    if (content.length > 200) {
      scores.set("analytical", (scores.get("analytical") || 0) + 1);
    }
    if (content.includes("?")) {
      scores.set("supportive", (scores.get("supportive") || 0) + 0.5);
    }

    // Find the style with highest score
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
