import { ConversationStyle } from "./common.types";

export interface AgentTraits {
  analyticalThinking: number;
  creativity: number;
  empathy: number;
  curiosity: number;
  enthusiasm: number;
  decisiveness?: number;
  efficiency?: number;
  adaptability?: number;
  reliability?: number;
  innovation?: number;
  leadership?: number;
  communication?: number;
  environmentalAwareness?: number;
  longTermThinking?: number;
  advocacy?: number;
  formality?: number;
}

export interface AgentContextualResponses {
  rain: string[];
  sunny: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  systemPrompt: string;
  interests: string[];
  preferredStyle: ConversationStyle;
  memoryWindowSize: number;
  emotionalRange: {
    min: number;
    max: number;
  };
  traits: AgentTraits;
  contextualResponses?: AgentContextualResponses;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
  metadata?: {
    departmentId?: string;
    role?: string;
    specialization?: string[];
  };
  districtId?: string;
  department?: string;
}
