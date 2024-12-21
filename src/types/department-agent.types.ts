export interface AgentHealth {
  physical: number; // 0-1 scale
  mental: number; // 0-1 scale
  energy: number; // 0-1 scale
  motivation: number; // 0-1 scale
  status: "healthy" | "tired" | "stressed" | "sick" | "recovering";
}

export interface AgentMood {
  happiness: number; // 0-1 scale
  satisfaction: number; // 0-1 scale
  enthusiasm: number; // 0-1 scale
  stress: number; // 0-1 scale
  lastUpdate: number;
}

export interface DepartmentAgent {
  id: string;
  departmentId: string;
  name: string;
  role: string;
  schedule: {
    availability: boolean;
    shifts: Array<{
      start: number;
      end: number;
    }>;
  };
  performance: {
    responseTime: number;
    resolutionRate: number;
    efficiency: number;
    citizenSatisfaction: number;
  };
  currentTask?: {
    type: string;
    description: string;
    priority: "low" | "medium" | "high";
    startTime?: number;
  };
  health: AgentHealth;
  mood: AgentMood;
  donationImpact: {
    recoveryRate: number;
    motivationBoost: number;
    lastDonationEffect: number;
  };
}
