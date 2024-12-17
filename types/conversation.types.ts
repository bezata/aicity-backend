export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: number;
  role: "user" | "assistant";
  context?: string;
  style?: string;
  topics?: string[];
  sentiment?: number;
}

export interface ConversationState {
  momentum: number;
  timeOfDay: string;
  currentStyle: string;
}
