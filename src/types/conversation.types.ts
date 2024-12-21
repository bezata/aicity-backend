import { ConversationStyle } from "./common.types";

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  sentiment?: number;
  topics?: string[];
}

export interface ConversationState {
  conversationId: string;
  lastMessageTimestamp: number;
  lastInteractionTime: number;
  messageCount: number;
  participants: string[];
  topics: string[];
  currentTopics: Set<string>;
  sentiment: number;
  status: "active" | "idle" | "inactive";
  momentum: number;
  silenceDuration: number;
  silenceProbability: number;
  interactionCount: number;
  timeOfDay: string;
  topicExhaustion: Map<string, number>;
  currentStyle: string;
  emotionalState: number;
  turnsInCurrentTopic: number;
}

export interface Event {
  type: string;
  description: string;
  duration: number;
  timestamp: number;
  effects: string[];
}

export interface ChatMetadata {
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  topics?: string[];
  style?: string;
  sentiment?: string;
  type?: string;
}
