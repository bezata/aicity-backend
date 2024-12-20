export interface Citizen {
  id: string;
  name: string;
  occupation: string;
  district: string;
  needs: CitizenNeed[];
  satisfaction: {
    infrastructure: number;
    services: number;
    safety: number;
    environment: number;
  };
  currentActivity?: {
    type: string;
    intensity: number;
    timestamp: number;
  };
  traits: {
    engagement: number;
    patience: number;
    environmentalism: number;
    communityFocus: number;
  };
  history: CitizenActivity[];
}

export interface CitizenNeed {
  type: "infrastructure" | "service" | "safety" | "environmental" | "social";
  description: string;
  urgency: number;
  status: "pending" | "in_progress" | "resolved";
  departmentId?: string;
  created: number;
  resolved?: number;
}

export interface CitizenActivity {
  type: "complaint" | "suggestion" | "participation" | "service_usage";
  description: string;
  timestamp: number;
  departmentId?: string;
  outcome?: string;
}
