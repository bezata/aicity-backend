import { ConversationStyle } from "./common.types";

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  context?: string;
  style?: ConversationStyle;
  topics?: string[];
  sentiment?: number;
}

export interface ConversationState {
  momentum: number; // 0 to 1
  lastInteractionTime: number;
  currentTopics: Set<string>;
  topicExhaustion: Map<string, number>;
  silenceProbability: number;
  currentStyle: ConversationStyle;
  emotionalState: number;
  turnsInCurrentTopic: number;
  silenceDuration: number;
  timeOfDay: string;
  interactionCount: number;
}

export interface Event {
  type: string;
  description: string;
  duration: number;
  timestamp: number;
  effects: string[];
}
