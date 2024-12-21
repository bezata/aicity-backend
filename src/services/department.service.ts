import { EventEmitter } from "events";
import {
  Department,
  DepartmentBudget,
  Donation,
  BudgetExpense,
} from "../types/department.types";
import {
  DepartmentAgent,
  AgentHealth,
  AgentMood,
} from "../types/department-agent.types";
import { VectorStoreService } from "./vector-store.service";
import { TogetherService } from "./together.service";

export interface DepartmentActivity {
  type: string;
  timestamp: number;
  [key: string]: any;
}

export class DepartmentService extends EventEmitter {
  private departments: Map<string, Department> = new Map();
  private departmentAgents: Map<string, DepartmentAgent[]> = new Map();
  private healthUpdateInterval!: NodeJS.Timer;

  constructor(
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService
  ) {
    super();
    this.initializeHealthMonitoring();
    this.initializePerformanceMonitoring();
  }

  private initializeHealthMonitoring() {
    // Update agent health every 30 minutes
    this.healthUpdateInterval = setInterval(() => {
      this.updateAgentHealth();
    }, 30 * 60 * 1000);
  }

  private async updateAgentHealth() {
    for (const [deptId, agents] of this.departmentAgents) {
      const department = this.departments.get(deptId);
      if (!department) continue;

      const budgetHealth =
        department.budget.total > 0
          ? (department.budget.total - department.budget.spent) /
            department.budget.total
          : 0;

      for (const agent of agents) {
        // Decrease health and mood over time
        agent.health.energy = Math.max(0, agent.health.energy - 0.1);
        agent.health.motivation = Math.max(0, agent.health.motivation - 0.05);
        agent.mood.enthusiasm = Math.max(0, agent.mood.enthusiasm - 0.08);

        // Affect health based on budget
        if (budgetHealth < 0.2) {
          agent.health.physical = Math.max(0, agent.health.physical - 0.15);
          agent.health.mental = Math.max(0, agent.health.mental - 0.2);
          agent.mood.stress = Math.min(1, agent.mood.stress + 0.2);
          agent.health.status = "stressed";
        }

        // Update overall status
        this.updateAgentStatus(agent);

        // Apply recovery if recent donations
        const timeSinceLastDonation =
          Date.now() - agent.donationImpact.lastDonationEffect;
        if (timeSinceLastDonation < 24 * 60 * 60 * 1000) {
          // Within 24 hours
          this.applyDonationRecovery(agent);
        }
      }

      this.departmentAgents.set(deptId, agents);
      this.emit("agentsHealthUpdated", { departmentId: deptId, agents });
    }
  }

  private updateAgentStatus(agent: DepartmentAgent) {
    const { physical, mental, energy, motivation } = agent.health;
    const averageHealth = (physical + mental + energy + motivation) / 4;

    if (averageHealth < 0.2) {
      agent.health.status = "sick";
    } else if (averageHealth < 0.4) {
      agent.health.status = "stressed";
    } else if (averageHealth < 0.6) {
      agent.health.status = "tired";
    } else if (
      agent.health.status === "sick" ||
      agent.health.status === "stressed"
    ) {
      agent.health.status = "recovering";
    } else {
      agent.health.status = "healthy";
    }
  }

  private applyDonationRecovery(agent: DepartmentAgent) {
    const recoveryAmount = agent.donationImpact.recoveryRate * 0.1;
    const motivationBoost = agent.donationImpact.motivationBoost * 0.15;

    agent.health.physical = Math.min(1, agent.health.physical + recoveryAmount);
    agent.health.mental = Math.min(1, agent.health.mental + recoveryAmount);
    agent.health.energy = Math.min(1, agent.health.energy + recoveryAmount);
    agent.health.motivation = Math.min(
      1,
      agent.health.motivation + motivationBoost
    );

    agent.mood.happiness = Math.min(1, agent.mood.happiness + 0.2);
    agent.mood.satisfaction = Math.min(1, agent.mood.satisfaction + 0.15);
    agent.mood.enthusiasm = Math.min(1, agent.mood.enthusiasm + 0.25);
    agent.mood.stress = Math.max(0, agent.mood.stress - 0.2);
  }

  async getAllDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  async createDepartment(department: Department): Promise<Department> {
    this.departments.set(department.id, department);

    await this.vectorStore.upsert({
      id: `department-${department.id}`,
      values: await this.vectorStore.createEmbedding(
        `${department.name} ${department.description} ${department.type}`
      ),
      metadata: {
        type: "district",
        departmentId: department.id,
        departmentType: department.type,
      },
    });

    return department;
  }

  async assignAgent(departmentId: string, agentId: string): Promise<void> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    department.assignedAgents.push(agentId);

    // Initialize agent health and mood
    const newAgent: DepartmentAgent = {
      id: agentId,
      departmentId,
      name: `Agent ${agentId.slice(0, 6)}`,
      role: "field_agent",
      schedule: {
        availability: true,
        shifts: [],
      },
      performance: {
        responseTime: 0.8,
        resolutionRate: 0.7,
        efficiency: 0.75,
        citizenSatisfaction: 0.8,
      },
      health: {
        physical: 1,
        mental: 1,
        energy: 1,
        motivation: 1,
        status: "healthy",
      },
      mood: {
        happiness: 0.8,
        satisfaction: 0.8,
        enthusiasm: 0.9,
        stress: 0.2,
        lastUpdate: Date.now(),
      },
      donationImpact: {
        recoveryRate: 0,
        motivationBoost: 0,
        lastDonationEffect: 0,
      },
    };

    const agents = this.departmentAgents.get(departmentId) || [];
    agents.push(newAgent);
    this.departmentAgents.set(departmentId, agents);

    await this.vectorStore.upsert({
      id: `department-agent-${departmentId}-${agentId}`,
      values: await this.vectorStore.createEmbedding(
        `Agent ${agentId} works in ${department.name} department`
      ),
      metadata: {
        type: "district",
        departmentId,
        agentId,
        timestamp: Date.now(),
      },
    });

    this.emit("agentAssigned", { departmentId, agent: newAgent });
  }

  async createDepartmentChat(
    departmentId: string,
    topic: string,
    participants: string[]
  ): Promise<string> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    const chatId = crypto.randomUUID();
    department.activeChats.push(chatId);

    await this.vectorStore.upsert({
      id: `department-chat-${chatId}`,
      values: await this.vectorStore.createEmbedding(
        `Department chat about ${topic} in ${department.name}`
      ),
      metadata: {
        type: "conversation",
        departmentId,
        chatId,
        topic,
        participants,
        timestamp: Date.now(),
      },
    });

    return chatId;
  }

  async getDepartmentBudget(departmentId: string): Promise<DepartmentBudget> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");
    return department.budget;
  }

  async addDonation(departmentId: string, donation: Donation): Promise<void> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    department.budget.donations += donation.amount;
    department.budget.total += donation.amount;
    department.budget.donations_history.push(donation);

    // Apply donation effects to agents
    const agents = this.departmentAgents.get(departmentId) || [];
    for (const agent of agents) {
      agent.donationImpact = {
        recoveryRate: Math.min(
          1,
          (donation.amount / department.budget.total) * 2
        ),
        motivationBoost: Math.min(
          1,
          (donation.amount / department.budget.total) * 3
        ),
        lastDonationEffect: Date.now(),
      };

      // Immediate mood boost
      agent.mood.happiness = Math.min(1, agent.mood.happiness + 0.3);
      agent.mood.satisfaction = Math.min(1, agent.mood.satisfaction + 0.25);
      agent.mood.enthusiasm = Math.min(1, agent.mood.enthusiasm + 0.35);
      agent.mood.stress = Math.max(0, agent.mood.stress - 0.3);
      agent.mood.lastUpdate = Date.now();

      // Start recovery if agent was sick or stressed
      if (
        agent.health.status === "sick" ||
        agent.health.status === "stressed"
      ) {
        agent.health.status = "recovering";
      }
    }
    this.departmentAgents.set(departmentId, agents);

    await this.vectorStore.upsert({
      id: `department-donation-${donation.id}`,
      values: await this.vectorStore.createEmbedding(
        `Donation of ${donation.amount} to ${department.name} department`
      ),
      metadata: {
        type: "district",
        departmentId,
        donationId: donation.id,
        amount: donation.amount,
        timestamp: donation.timestamp,
      },
    });

    this.emit("donationReceived", {
      departmentId,
      donation,
      agentImpact: agents.length,
    });
  }

  async addExpense(
    departmentId: string,
    expense: BudgetExpense
  ): Promise<void> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    if (expense.amount > department.budget.total - department.budget.spent) {
      throw new Error("Insufficient budget");
    }

    department.budget.spent += expense.amount;
    department.budget.expenses.push(expense);

    await this.vectorStore.upsert({
      id: `department-expense-${expense.id}`,
      values: await this.vectorStore.createEmbedding(
        `Expense of ${expense.amount} for ${expense.description} in ${department.name} department`
      ),
      metadata: {
        type: "district",
        departmentId,
        expenseId: expense.id,
        amount: expense.amount,
        category: expense.category,
        timestamp: expense.timestamp,
      },
    });

    this.emit("expenseAdded", { departmentId, expense });
  }

  async addActivity(
    departmentId: string,
    activity: DepartmentActivity
  ): Promise<void> {
    // Implementation
  }

  async getDepartmentAgents(departmentId: string): Promise<DepartmentAgent[]> {
    return this.departmentAgents.get(departmentId) || [];
  }

  async healAgent(
    departmentId: string,
    agentId: string,
    treatment: {
      treatment: string;
      duration: number;
      cost: number;
    }
  ): Promise<DepartmentAgent> {
    const agents = await this.getDepartmentAgents(departmentId);
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) throw new Error("Agent not found");

    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    // Check if department has enough budget
    if (department.budget.total - department.budget.spent < treatment.cost) {
      throw new Error("Insufficient department budget for treatment");
    }

    // Add treatment expense
    await this.addExpense(departmentId, {
      id: crypto.randomUUID(),
      amount: treatment.cost,
      category: "personnel",
      description: `Medical treatment for agent ${agent.name}: ${treatment.treatment}`,
      timestamp: Date.now(),
      approvedBy: "system",
    });

    // Apply healing effects
    const healingPower = treatment.cost / 1000; // Scale healing based on cost
    agent.health.physical = Math.min(
      1,
      agent.health.physical + healingPower * 0.3
    );
    agent.health.mental = Math.min(1, agent.health.mental + healingPower * 0.3);
    agent.health.energy = Math.min(1, agent.health.energy + healingPower * 0.2);
    agent.health.motivation = Math.min(
      1,
      agent.health.motivation + healingPower * 0.2
    );

    // Update mood
    agent.mood.stress = Math.max(0, agent.mood.stress - healingPower * 0.4);
    agent.mood.happiness = Math.min(
      1,
      agent.mood.happiness + healingPower * 0.2
    );
    agent.mood.satisfaction = Math.min(
      1,
      agent.mood.satisfaction + healingPower * 0.2
    );
    agent.mood.lastUpdate = Date.now();

    // Update status if health improved significantly
    if (healingPower > 0.5) {
      agent.health.status = "recovering";
    }

    // Store healing event
    await this.vectorStore.upsert({
      id: `agent-healing-${agentId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Agent ${agent.name} received treatment: ${treatment.treatment}`
      ),
      metadata: {
        type: "district",
        departmentId,
        agentId,
        treatment: treatment.treatment,
        cost: treatment.cost,
        timestamp: Date.now(),
      },
    });

    this.emit("agentHealed", { departmentId, agent, treatment });
    return agent;
  }

  private async updateDepartmentPerformance(departmentId: string) {
    const department = this.departments.get(departmentId);
    if (!department) return;

    const agents = await this.getDepartmentAgents(departmentId);
    if (agents.length === 0) return;

    interface HealthStats {
      physical: number;
      mental: number;
      energy: number;
      motivation: number;
      happiness: number;
      satisfaction: number;
      stress: number;
    }

    // Calculate average agent health and mood
    const healthStats = agents.reduce<HealthStats>(
      (acc, agent) => {
        acc.physical += agent.health.physical;
        acc.mental += agent.health.mental;
        acc.energy += agent.health.energy;
        acc.motivation += agent.health.motivation;
        acc.happiness += agent.mood.happiness;
        acc.satisfaction += agent.mood.satisfaction;
        acc.stress += agent.mood.stress;
        return acc;
      },
      {
        physical: 0,
        mental: 0,
        energy: 0,
        motivation: 0,
        happiness: 0,
        satisfaction: 0,
        stress: 0,
      }
    );

    const agentCount = agents.length;
    (Object.keys(healthStats) as Array<keyof HealthStats>).forEach((key) => {
      healthStats[key] /= agentCount;
    });

    // Calculate budget health
    const budgetHealth =
      department.budget.total > 0
        ? (department.budget.total - department.budget.spent) /
          department.budget.total
        : 0;

    // Update department metrics based on agent health and budget
    department.metrics = {
      efficiency:
        (healthStats.energy * 0.3 +
          healthStats.motivation * 0.3 +
          budgetHealth * 0.4) *
        (1 - healthStats.stress * 0.5),
      responseTime:
        (healthStats.physical * 0.4 + healthStats.energy * 0.6) *
        (1 - healthStats.stress * 0.3),
      successRate:
        (healthStats.mental * 0.3 +
          healthStats.motivation * 0.4 +
          budgetHealth * 0.3) *
        (1 - healthStats.stress * 0.4),
      collaborationScore:
        (healthStats.happiness * 0.4 + healthStats.satisfaction * 0.6) *
        (1 - healthStats.stress * 0.2),
    };

    // Store performance update in vector store
    await this.vectorStore.upsert({
      id: `department-performance-${departmentId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Department ${department.name} performance update: efficiency ${department.metrics.efficiency}, response time ${department.metrics.responseTime}, success rate ${department.metrics.successRate}, collaboration ${department.metrics.collaborationScore}`
      ),
      metadata: {
        type: "district",
        departmentId,
        metrics: JSON.stringify(department.metrics),
        agentHealth: JSON.stringify(healthStats),
        budgetHealth,
        timestamp: Date.now(),
      },
    });

    this.departments.set(departmentId, department);
    this.emit("departmentPerformanceUpdated", {
      departmentId,
      metrics: department.metrics,
      healthStats,
      budgetHealth,
    });
  }

  private initializePerformanceMonitoring() {
    // Update department performance every hour
    setInterval(() => {
      for (const departmentId of this.departments.keys()) {
        this.updateDepartmentPerformance(departmentId);
      }
    }, 60 * 60 * 1000);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    return this.departments.get(id);
  }
}
