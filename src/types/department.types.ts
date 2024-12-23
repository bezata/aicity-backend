export type DepartmentType =
  | "emergency_response"
  | "urban_planning"
  | "public_safety"
  | "environmental"
  | "infrastructure"
  | "social_services"
  | "transportation"
  | "law_enforcement"
  | "fire_services"
  | "healthcare"
  | "education"
  | "economy";

export interface DepartmentBudget {
  total: number;
  allocated: number;
  spent: number;
  donations: number;
  expenses: BudgetExpense[];
  donations_history: Donation[];
}

export interface BudgetExpense {
  id: string;
  amount: number;
  category:
    | "equipment"
    | "personnel"
    | "operations"
    | "maintenance"
    | "emergency";
  description: string;
  timestamp: number;
  approvedBy: string;
}

export interface Donation {
  id: string;
  amount: number;
  donorId?: string;
  timestamp: number;
  message?: string;
  transactionHash?: string; // For blockchain transactions
}

export interface Department {
  id: string;
  name: string;
  type: DepartmentType;
  description: string;
  assignedAgents: string[];
  activeChats: string[];
  currentProjects: {
    id: string;
    title: string;
    status: "active" | "pending" | "completed";
    assignedAgents: string[];
    priority: "low" | "medium" | "high";
  }[];
  metrics: {
    efficiency: number;
    responseTime: number;
    successRate: number;
    collaborationScore: number;
  };
  budget: DepartmentBudget;
}
