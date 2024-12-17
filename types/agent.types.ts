export interface Agent {
  id: string;
  name: string;
  avatar: {
    initial: string;
    color: string;
  };
  personality: string;
  interests: string[];
  systemPrompt: string;
  preferredStyle: string;
  memoryWindowSize: number;
  emotionalRange: {
    min: number;
    max: number;
  };
}
