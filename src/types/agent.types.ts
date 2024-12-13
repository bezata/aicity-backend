import { ConversationStyle } from "./common.types";

export interface AgentTraits {
  curiosity: number;
  enthusiasm: number;
  formality: number;
  empathy: number;
  analyticalThinking: number;
  creativity: number;
}

export interface AgentContextualResponses {
  rain: string[];
  sunny: string[];
}

export interface Agent {
  id: string;
  name: string;
  personality: string;
  systemPrompt: string;
  interests: string[];
  preferredStyle: ConversationStyle;
  memoryWindowSize: number;
  emotionalRange: {
    min: number;
    max: number;
  };
  traits?: AgentTraits;
  contextualResponses?: AgentContextualResponses;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
