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
import { AnalyticsService } from "./analytics.service";
import { MetricsService } from "./metrics.service";

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
    private togetherService: TogetherService,
    private analyticsService: AnalyticsService,
    private metricsService: MetricsService
  ) {
    super();
    this.initializeHealthMonitoring();
    this.initializePerformanceMonitoring();
    this.initializeDefaultDepartments();
  }

  private initializeHealthMonitoring() {
    // Update agent health every 30 minutes
    this.healthUpdateInterval = setInterval(() => {
      this.updateAgentHealth();
    }, 30 * 60 * 1000);

    this.analyticsService.trackEvent(
      "department_health_monitoring_initialized",
      {
        timestamp: Date.now(),
        updateInterval: "30m",
      }
    );
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

      let updatedAgentsCount = 0;
      let stressedAgentsCount = 0;

      for (const agent of agents) {
        // Track previous status for analytics
        const previousStatus = agent.health.status;

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
          stressedAgentsCount++;
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

        // Track status changes
        if (previousStatus !== agent.health.status) {
          this.analyticsService.trackEvent("agent_status_changed", {
            departmentId: deptId,
            agentId: agent.id,
            previousStatus,
            newStatus: agent.health.status,
            timestamp: Date.now(),
          });
        }

        updatedAgentsCount++;
      }

      this.departmentAgents.set(deptId, agents);
      this.emit("agentsHealthUpdated", { departmentId: deptId, agents });

      // Track department health metrics
      this.analyticsService.trackEvent("department_health_updated", {
        departmentId: deptId,
        totalAgents: agents.length,
        updatedAgents: updatedAgentsCount,
        stressedAgents: stressedAgentsCount,
        budgetHealth,
        timestamp: Date.now(),
      });
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

    this.analyticsService.trackEvent("department_created", {
      departmentId: department.id,
      type: department.type,
      timestamp: Date.now(),
    });

    return department;
  }

  async assignAgent(departmentId: string, agentId: string): Promise<void> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    // Add agent to department's assignedAgents array if not already present
    if (!department.assignedAgents.includes(agentId)) {
      department.assignedAgents.push(agentId);
      // Update the department in the map
      this.departments.set(departmentId, department);
    }

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

    this.analyticsService.trackEvent("agent_assigned", {
      departmentId,
      agentId,
      role: newAgent.role,
      timestamp: Date.now(),
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
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    await this.vectorStore.upsert({
      id: `department-activity-${departmentId}-${activity.timestamp}`,
      values: await this.vectorStore.createEmbedding(
        `Department ${department.name} activity: ${activity.type}`
      ),
      metadata: {
        type: "district",
        departmentId,
        activityType: activity.type,
        timestamp: activity.timestamp,
        details: JSON.stringify(activity),
      },
    });

    // Update department metrics based on activity
    if (activity.type === "emergency_response") {
      department.metrics.responseTime = Math.min(
        1,
        department.metrics.responseTime * 1.1
      );
    } else if (activity.type === "successful_operation") {
      department.metrics.successRate = Math.min(
        1,
        department.metrics.successRate * 1.05
      );
    } else if (activity.type === "collaboration") {
      department.metrics.collaborationScore = Math.min(
        1,
        department.metrics.collaborationScore * 1.05
      );
    } else if (activity.type === "training") {
      const agents = await this.getDepartmentAgents(departmentId);
      for (const agent of agents) {
        agent.health.motivation = Math.min(1, agent.health.motivation + 0.1);
        agent.health.energy = Math.min(1, agent.health.energy + 0.05);
        agent.mood.enthusiasm = Math.min(1, agent.mood.enthusiasm + 0.1);
      }
      this.departmentAgents.set(departmentId, agents);
    }

    this.departments.set(departmentId, department);
    this.emit("activityAdded", { departmentId, activity });
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

    // Track initial state for analytics
    const initialHealth = { ...agent.health };
    const initialMood = { ...agent.mood };

    // Check if department has enough budget
    if (department.budget.total - department.budget.spent < treatment.cost) {
      this.analyticsService.trackEvent("treatment_failed", {
        departmentId,
        agentId,
        reason: "insufficient_budget",
        treatment: treatment.treatment,
        cost: treatment.cost,
        availableBudget: department.budget.total - department.budget.spent,
        timestamp: Date.now(),
      });
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

    // Track treatment effectiveness
    this.analyticsService.trackEvent("treatment_applied", {
      departmentId,
      agentId,
      treatment: treatment.treatment,
      cost: treatment.cost,
      healthImprovement: {
        physical: agent.health.physical - initialHealth.physical,
        mental: agent.health.mental - initialHealth.mental,
        energy: agent.health.energy - initialHealth.energy,
        motivation: agent.health.motivation - initialHealth.motivation,
      },
      moodImprovement: {
        stress: initialMood.stress - agent.mood.stress,
        happiness: agent.mood.happiness - initialMood.happiness,
        satisfaction: agent.mood.satisfaction - initialMood.satisfaction,
      },
      timestamp: Date.now(),
    });

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

  private async updateDepartmentMetrics(departmentId: string) {
    const department = this.departments.get(departmentId);
    if (!department) return;

    const agents = await this.getDepartmentAgents(departmentId);
    const avgHealth =
      agents.reduce((sum, agent) => {
        const health =
          (agent.health.physical +
            agent.health.mental +
            agent.health.energy +
            agent.health.motivation) /
          4;
        return sum + health;
      }, 0) / agents.length;

    const avgMood =
      agents.reduce((sum, agent) => {
        const mood =
          (agent.mood.happiness +
            agent.mood.satisfaction +
            agent.mood.enthusiasm -
            agent.mood.stress) /
          4;
        return sum + mood;
      }, 0) / agents.length;

    await this.metricsService.updateMetrics({
      social: {
        healthcareAccessScore: avgHealth,
        educationQualityIndex: 0.8,
        communityWellbeing: avgMood,
      },
      infrastructure: {
        maintenanceRequests: 23,
        serviceUptime: 0.99,
        healthScore: department.metrics.efficiency,
        developmentProgress: 0.8,
        wasteRecyclingRate: 0.6,
        smartGridEfficiency: 0.8,
      },
      safety: {
        overallScore: 0.9,
        recentIncidents: 3,
        responseTime: "2.5 min",
        serviceAvailability: 0.98,
        crimeRate: 2.1,
        emergencyResponseTime: department.metrics.responseTime,
        publicTrustIndex: department.metrics.collaborationScore,
        disasterReadiness: 0.8,
      },
    });
  }

  private initializePerformanceMonitoring() {
    // Update performance metrics hourly
    setInterval(async () => {
      for (const [departmentId, department] of this.departments) {
        const agents = await this.getDepartmentAgents(departmentId);

        // Update department metrics
        department.metrics.responseTime =
          agents.reduce(
            (sum, agent) => sum + agent.performance.responseTime,
            0
          ) / agents.length;
        department.metrics.successRate =
          agents.reduce(
            (sum, agent) => sum + agent.performance.resolutionRate,
            0
          ) / agents.length;
        department.metrics.collaborationScore =
          agents.reduce(
            (sum, agent) => sum + agent.performance.citizenSatisfaction,
            0
          ) / agents.length;
        department.metrics.efficiency =
          agents.reduce((sum, agent) => sum + agent.performance.efficiency, 0) /
          agents.length;

        await this.updateDepartmentMetrics(departmentId);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    return this.departments.get(id);
  }

  private async initializeDefaultDepartments() {
    const defaultDepartments = [
      {
        id: "economy-dept",
        name: "Economy Department",
        type: "economy" as const,
        description:
          "Manages economic development, financial planning, and business relations",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.89,
          responseTime: 0.83,
          successRate: 0.87,
          collaborationScore: 0.86,
        },
        budget: {
          total: 2800000,
          allocated: 2300000,
          spent: 1200000,
          donations: 500000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "emergency-response-dept",
        name: "Emergency Response Department",
        type: "emergency_response" as const,
        description: "Handles emergency situations and crisis management",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.9,
          responseTime: 0.95,
          successRate: 0.85,
          collaborationScore: 0.8,
        },
        budget: {
          total: 1000000,
          allocated: 800000,
          spent: 400000,
          donations: 200000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "police-dept",
        name: "Police Department",
        type: "law_enforcement" as const,
        description:
          "Maintains law and order, investigates crimes, and ensures public safety",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.92,
          responseTime: 0.94,
          successRate: 0.88,
          collaborationScore: 0.85,
        },
        budget: {
          total: 2500000,
          allocated: 2000000,
          spent: 1200000,
          donations: 500000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "fire-dept",
        name: "Fire Department",
        type: "fire_services" as const,
        description:
          "Provides fire prevention, firefighting, and rescue services",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.93,
          responseTime: 0.96,
          successRate: 0.91,
          collaborationScore: 0.87,
        },
        budget: {
          total: 1800000,
          allocated: 1500000,
          spent: 900000,
          donations: 300000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "healthcare-dept",
        name: "Healthcare Department",
        type: "healthcare" as const,
        description: "Manages public health services and healthcare facilities",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.87,
          responseTime: 0.85,
          successRate: 0.89,
          collaborationScore: 0.86,
        },
        budget: {
          total: 2200000,
          allocated: 1800000,
          spent: 1100000,
          donations: 400000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "urban-planning-dept",
        name: "Urban Planning Department",
        type: "urban_planning" as const,
        description: "Responsible for city planning and development",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.85,
          responseTime: 0.75,
          successRate: 0.9,
          collaborationScore: 0.85,
        },
        budget: {
          total: 2000000,
          allocated: 1500000,
          spent: 1000000,
          donations: 500000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "public-safety-dept",
        name: "Public Safety Department",
        type: "public_safety" as const,
        description: "Ensures public safety and security",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.88,
          responseTime: 0.92,
          successRate: 0.87,
          collaborationScore: 0.83,
        },
        budget: {
          total: 1500000,
          allocated: 1200000,
          spent: 800000,
          donations: 300000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "environmental-dept",
        name: "Environmental Department",
        type: "environmental" as const,
        description: "Manages environmental protection and sustainability",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.82,
          responseTime: 0.78,
          successRate: 0.85,
          collaborationScore: 0.88,
        },
        budget: {
          total: 1200000,
          allocated: 1000000,
          spent: 600000,
          donations: 200000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "transportation-dept",
        name: "Transportation Department",
        type: "transportation" as const,
        description: "Manages public transportation and traffic infrastructure",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.84,
          responseTime: 0.82,
          successRate: 0.86,
          collaborationScore: 0.85,
        },
        budget: {
          total: 1800000,
          allocated: 1500000,
          spent: 900000,
          donations: 300000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "education-dept",
        name: "Education Department",
        type: "education" as const,
        description: "Oversees educational institutions and programs",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.86,
          responseTime: 0.8,
          successRate: 0.88,
          collaborationScore: 0.9,
        },
        budget: {
          total: 2000000,
          allocated: 1700000,
          spent: 1000000,
          donations: 300000,
          expenses: [],
          donations_history: [],
        },
      },
      {
        id: "social-services-dept",
        name: "Social Services Department",
        type: "social_services" as const,
        description: "Provides social welfare and community support services",
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.83,
          responseTime: 0.81,
          successRate: 0.85,
          collaborationScore: 0.89,
        },
        budget: {
          total: 1600000,
          allocated: 1300000,
          spent: 800000,
          donations: 300000,
          expenses: [],
          donations_history: [],
        },
      },
    ];

    for (const dept of defaultDepartments) {
      if (!this.departments.has(dept.id)) {
        await this.createDepartment(dept);
        // Create and assign some default agents
        await this.createDefaultAgentsForDepartment(dept.id);
      }
    }

    console.log(`Initialized ${defaultDepartments.length} default departments`);
  }

  private async createDefaultAgentsForDepartment(departmentId: string) {
    const department = await this.getDepartment(departmentId);
    if (!department) return;

    const numAgents = Math.floor(Math.random() * 5) + 5; // 5-10 agents per department
    const roles = [
      "field_agent",
      "supervisor",
      "specialist",
      "coordinator",
      "analyst",
    ];

    for (let i = 0; i < numAgents; i++) {
      const agentId = crypto.randomUUID();
      await this.assignAgent(departmentId, agentId);

      // Update the agent with more specific details
      const agents = await this.getDepartmentAgents(departmentId);
      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        agent.name = `${department.name.split(" ")[0]}-Agent-${i + 1}`;
        agent.role = roles[Math.floor(Math.random() * roles.length)];

        // Randomize performance metrics slightly
        agent.performance = {
          responseTime: 0.7 + Math.random() * 0.3,
          resolutionRate: 0.7 + Math.random() * 0.3,
          efficiency: 0.7 + Math.random() * 0.3,
          citizenSatisfaction: 0.7 + Math.random() * 0.3,
        };
      }
    }
  }
}
