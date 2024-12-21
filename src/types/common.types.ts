export type ConversationStyle =
  | "formal"
  | "casual"
  | "technical"
  | "empathetic"
  | "analytical"
  | "visionary"
  | "nurturing"
  | "precise"
  | "philosophical"
  | "playful"
  | "serious"
  | "adaptive"
  | "diplomatic"
  | "educational"
  | "inspirational"
  | "strategic"
  | "creative"
  | "investigative"
  | "collaborative"
  | "mentoring"
  | "storytelling"
  | "pragmatic"
  | "scholarly"
  | "persuasive"
  | "supportive"
  | "innovative"
  | "methodical"
  | "intuitive"
  | "adaptable"
  | "instructional"
  | "reflective"
  | "engaging"
  | "assertive"
  | "contemplative"
  | "dynamic"
  | "wise"
  | "compassionate"
  | "mindful"
  | "traditional"
  | "organized";

export interface StyleCharacteristics {
  formality: number; // 0 to 1, where 0 is very informal and 1 is very formal
  technicalDepth: number; // 0 to 1, where 0 is non-technical and 1 is highly technical
  emotionalExpression: number; // 0 to 1, where 0 is neutral and 1 is highly emotional
  pace: number; // 0 to 1, where 0 is slow/deliberate and 1 is fast/dynamic
}

export const styleCharacteristics: Record<
  ConversationStyle,
  StyleCharacteristics
> = {
  formal: {
    formality: 0.9,
    technicalDepth: 0.6,
    emotionalExpression: 0.2,
    pace: 0.4,
  },
  casual: {
    formality: 0.2,
    technicalDepth: 0.3,
    emotionalExpression: 0.7,
    pace: 0.7,
  },
  technical: {
    formality: 0.8,
    technicalDepth: 0.9,
    emotionalExpression: 0.1,
    pace: 0.5,
  },
  adaptive: {
    formality: 0.5,
    technicalDepth: 0.6,
    emotionalExpression: 0.7,
    pace: 0.9,
  },
  empathetic: {
    formality: 0.4,
    technicalDepth: 0.3,
    emotionalExpression: 0.9,
    pace: 0.5,
  },
  analytical: {
    formality: 0.7,
    technicalDepth: 0.8,
    emotionalExpression: 0.2,
    pace: 0.6,
  },
  visionary: {
    formality: 0.6,
    technicalDepth: 0.5,
    emotionalExpression: 0.8,
    pace: 0.8,
  },
  nurturing: {
    formality: 0.3,
    technicalDepth: 0.2,
    emotionalExpression: 0.9,
    pace: 0.4,
  },
  precise: {
    formality: 0.8,
    technicalDepth: 0.9,
    emotionalExpression: 0.1,
    pace: 0.5,
  },
  philosophical: {
    formality: 0.7,
    technicalDepth: 0.6,
    emotionalExpression: 0.5,
    pace: 0.3,
  },
  playful: {
    formality: 0.1,
    technicalDepth: 0.2,
    emotionalExpression: 0.9,
    pace: 0.9,
  },
  serious: {
    formality: 0.8,
    technicalDepth: 0.7,
    emotionalExpression: 0.2,
    pace: 0.4,
  },
  diplomatic: {
    formality: 0.8,
    technicalDepth: 0.5,
    emotionalExpression: 0.6,
    pace: 0.4,
  },
  educational: {
    formality: 0.6,
    technicalDepth: 0.7,
    emotionalExpression: 0.5,
    pace: 0.5,
  },
  inspirational: {
    formality: 0.5,
    technicalDepth: 0.4,
    emotionalExpression: 0.9,
    pace: 0.8,
  },
  strategic: {
    formality: 0.7,
    technicalDepth: 0.8,
    emotionalExpression: 0.3,
    pace: 0.6,
  },
  creative: {
    formality: 0.3,
    technicalDepth: 0.4,
    emotionalExpression: 0.8,
    pace: 0.7,
  },
  investigative: {
    formality: 0.6,
    technicalDepth: 0.8,
    emotionalExpression: 0.3,
    pace: 0.6,
  },
  collaborative: {
    formality: 0.4,
    technicalDepth: 0.5,
    emotionalExpression: 0.7,
    pace: 0.6,
  },
  mentoring: {
    formality: 0.5,
    technicalDepth: 0.6,
    emotionalExpression: 0.7,
    pace: 0.5,
  },
  storytelling: {
    formality: 0.3,
    technicalDepth: 0.3,
    emotionalExpression: 0.8,
    pace: 0.7,
  },
  pragmatic: {
    formality: 0.6,
    technicalDepth: 0.7,
    emotionalExpression: 0.3,
    pace: 0.6,
  },
  scholarly: {
    formality: 0.9,
    technicalDepth: 0.9,
    emotionalExpression: 0.2,
    pace: 0.4,
  },
  persuasive: {
    formality: 0.6,
    technicalDepth: 0.5,
    emotionalExpression: 0.8,
    pace: 0.7,
  },
  supportive: {
    formality: 0.4,
    technicalDepth: 0.3,
    emotionalExpression: 0.9,
    pace: 0.5,
  },
  innovative: {
    formality: 0.5,
    technicalDepth: 0.8,
    emotionalExpression: 0.6,
    pace: 0.8,
  },
  methodical: {
    formality: 0.7,
    technicalDepth: 0.8,
    emotionalExpression: 0.2,
    pace: 0.3,
  },
  intuitive: {
    formality: 0.4,
    technicalDepth: 0.4,
    emotionalExpression: 0.8,
    pace: 0.7,
  },
  adaptable: {
    formality: 0.5,
    technicalDepth: 0.5,
    emotionalExpression: 0.6,
    pace: 0.7,
  },
  instructional: {
    formality: 0.7,
    technicalDepth: 0.7,
    emotionalExpression: 0.4,
    pace: 0.5,
  },
  reflective: {
    formality: 0.6,
    technicalDepth: 0.5,
    emotionalExpression: 0.7,
    pace: 0.3,
  },
  engaging: {
    formality: 0.4,
    technicalDepth: 0.4,
    emotionalExpression: 0.8,
    pace: 0.8,
  },
  assertive: {
    formality: 0.7,
    technicalDepth: 0.6,
    emotionalExpression: 0.5,
    pace: 0.8,
  },
  contemplative: {
    formality: 0.6,
    technicalDepth: 0.5,
    emotionalExpression: 0.6,
    pace: 0.3,
  },
  dynamic: {
    formality: 0.5,
    technicalDepth: 0.6,
    emotionalExpression: 0.7,
    pace: 0.9,
  },
};

export const getStyleCharacteristics = (
  style: ConversationStyle
): StyleCharacteristics => {
  return styleCharacteristics[style];
};

export const findSimilarStyles = (
  style: ConversationStyle,
  threshold: number = 0.2
): ConversationStyle[] => {
  const baseStyle = styleCharacteristics[style];
  return Object.entries(styleCharacteristics)
    .filter(([key, characteristics]) => {
      if (key === style) return false;

      const formDiff = Math.abs(
        baseStyle.formality - characteristics.formality
      );
      const techDiff = Math.abs(
        baseStyle.technicalDepth - characteristics.technicalDepth
      );
      const emotDiff = Math.abs(
        baseStyle.emotionalExpression - characteristics.emotionalExpression
      );
      const paceDiff = Math.abs(baseStyle.pace - characteristics.pace);

      const avgDiff = (formDiff + techDiff + emotDiff + paceDiff) / 4;
      return avgDiff <= threshold;
    })
    .map(([key]) => key as ConversationStyle);
};
