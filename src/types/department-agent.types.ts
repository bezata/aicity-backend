export interface DepartmentAgent {
  id: string;
  name: string;
  departmentId: string;
  role: "manager" | "specialist" | "field_agent" | "coordinator";
  expertise: string[];
  currentTask?: {
    type: "citizen_request" | "maintenance" | "emergency" | "planning";
    description: string;
    priority: "low" | "medium" | "high";
    deadline?: number;
  };
  performance: {
    responseTime: number;
    resolutionRate: number;
    citizenFeedback: number;
    efficiency: number;
  };
  schedule: {
    shift: "morning" | "afternoon" | "night";
    availability: boolean;
    lastActive: number;
  };
}
