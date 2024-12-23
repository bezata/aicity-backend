import { ConversationStyle } from "./common.types";

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "assistant" | "user";
  sentiment?: number;
  topics?: string[];
  metadata?: {
    emergencyId?: string;
    type?: string;
    severity?: string;
    isEmergency?: boolean;
    eventId?: string;
    culturalImpact?: number;
    conversationId?: string;
    coordinates?: string[];
    style?: string;
  };
}

export type ConversationStatus = "active" | "idle" | "inactive";

export interface ConversationState {
  conversationId: string;
  lastMessageTimestamp: number;
  lastInteractionTime: number;
  messageCount: number;
  participants: string[];
  topics: string[];
  currentTopics: Set<string>;
  sentiment: number;
  status: ConversationStatus;
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
  type: string;
  agentId: string;
  content?: string;
  sentiment?: string;
  timestamp: number;
  role?: string;
  topics?: string[];
  conversationId: string;
  coordinates?: string[];
  style?: string;
}

export interface ConversationEvent {
  sentiment: number;
  topic?: string;
  districtId?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}
