import { EventEmitter } from "events";
import {
  Department,
  DepartmentBudget,
  Donation,
  BudgetExpense,
  DepartmentType,
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
import { AgentCollaborationService } from "./agent-collaboration.service";
import { CityEvent, CityEventCategory } from "../types/city-events";
import { Agent, AgentTraits } from "../types/agent.types";
import { getAgent } from "../config/city-agents";
import { CityService } from "./city.service";
import type { WeatherState, CityMood } from "../types/city.types";
import { Message } from "../types/conversation.types";
import _ from "lodash";
import { CulturalEvent } from "../types/culture.types";
import { EventBus } from "./event-bus.service";

interface AgentHealthMetrics {
  physical: number;
  mental: number;
  energy: number;
  motivation: number;
  happiness: number;
  satisfaction: number;
  stress: number;
}

export interface DepartmentActivity {
  type: string;
  timestamp: number;
  [key: string]: any;
}

// Add new interface for department events
interface DepartmentEvent {
  id: string;
  type:
    | "infrastructure"
    | "cultural"
    | "educational"
    | "environmental"
    | "social";
  title: string;
  description: string;
  requiredBudget: number;
  currentBudget: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  departmentId: string;
  districtId: string;
  participants: string[];
  startDate: number;
  endDate?: number;
  metrics: {
    communityImpact: number;
    progress: number;
    participation: number;
  };
}

export class DepartmentService extends EventEmitter {
  private departments: Map<string, Department> = new Map();
  private departmentAgents: Map<string, DepartmentAgent[]> = new Map();
  private departmentEvents: Map<string, DepartmentEvent[]> = new Map();
  private healthUpdateInterval!: NodeJS.Timer;
  private readonly eventBus: EventBus;

  constructor(
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService,
    private analyticsService: AnalyticsService,
    private metricsService: MetricsService,
    private collaborationService: AgentCollaborationService
  ) {
    super();
    this.eventBus = EventBus.getInstance();
    this.departmentEvents = new Map();
    this.initializeHealthMonitoring();
    this.initializePerformanceMonitoring();
    this.initializeDefaultDepartments().then(() => {
      this.initializeDefaultEvents();
      this.initializePeriodicActivities();
    });
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

  async addDonation(
    departmentId: string,
    donation: Donation
  ): Promise<{ donationId: string }> {
    const department = this.departments.get(departmentId);
    if (!department) throw new Error("Department not found");

    // Update budget
    department.budget.donations += donation.amount;
    department.budget.total += donation.amount;
    department.budget.donations_history.push(donation);

    // Calculate budget health and efficiency metrics
    const budgetHealth =
      (department.budget.total - department.budget.spent) /
      department.budget.total;
    const significantDonation =
      donation.amount >= department.budget.total * 0.1; // 10% or more of total budget

    // Apply efficiency improvements to department
    if (significantDonation) {
      // Improve department operational metrics
      department.metrics.efficiency = Math.min(
        1,
        department.metrics.efficiency + 0.15
      );
      department.metrics.responseTime = Math.min(
        1,
        department.metrics.responseTime + 0.1
      );
      department.metrics.successRate = Math.min(
        1,
        department.metrics.successRate + 0.12
      );
      department.metrics.collaborationScore = Math.min(
        1,
        department.metrics.collaborationScore + 0.08
      );

      // Create a collaboration event for budget allocation planning
      const collaborationEvent = {
        id: `budget-planning-${donation.id}`,
        title: `Budget Allocation Planning - ${department.name}`,
        description: `Strategic planning session for allocating significant donation of $${donation.amount.toLocaleString()}`,
        category: "development" as CityEventCategory,
        severity: 0.4,
        urgency: 0.6,
        duration: 3600000, // 1 hour
        impact: {
          social: 0.7,
          economic: 0.9,
          cultural: 0.5,
          environmental: 0.6,
        },
        affectedDistricts: ["central-district"],
        requiredAgents: department.assignedAgents.slice(0, 5), // Top 5 agents
        timestamp: Date.now(),
        status: "pending" as const,
      };

      // Trigger collaboration for budget planning
      await this.collaborationService.initiateCollaboration(collaborationEvent);
    }

    // Apply donation effects to agents with focus on performance
    const agents = this.departmentAgents.get(departmentId) || [];
    for (const agent of agents) {
      // Calculate impact based on donation size relative to budget
      const donationImpact = donation.amount / department.budget.total;

      // Update agent performance metrics
      agent.performance.efficiency = Math.min(
        1,
        agent.performance.efficiency + donationImpact * 0.2
      );
      agent.performance.responseTime = Math.min(
        1,
        agent.performance.responseTime + donationImpact * 0.15
      );
      agent.performance.resolutionRate = Math.min(
        1,
        agent.performance.resolutionRate + donationImpact * 0.15
      );
      agent.performance.citizenSatisfaction = Math.min(
        1,
        agent.performance.citizenSatisfaction + donationImpact * 0.1
      );

      // Update agent health and motivation
      agent.health.energy = Math.min(
        1,
        agent.health.energy + donationImpact * 0.3
      );
      agent.health.motivation = Math.min(
        1,
        agent.health.motivation + donationImpact * 0.4
      );
      agent.health.physical = Math.min(
        1,
        agent.health.physical + donationImpact * 0.2
      );
      agent.health.mental = Math.min(
        1,
        agent.health.mental + donationImpact * 0.2
      );

      // Update mood with focus on work satisfaction
      agent.mood.satisfaction = Math.min(
        1,
        agent.mood.satisfaction + donationImpact * 0.3
      );
      agent.mood.enthusiasm = Math.min(
        1,
        agent.mood.enthusiasm + donationImpact * 0.25
      );
      agent.mood.stress = Math.max(0, agent.mood.stress - donationImpact * 0.3);
      agent.mood.lastUpdate = Date.now();

      // Track donation impact for future reference
      agent.donationImpact = {
        recoveryRate: Math.min(1, donationImpact * 2),
        motivationBoost: Math.min(1, donationImpact * 2.5),
        lastDonationEffect: Date.now(),
      };

      // Improve agent status if needed
      if (
        agent.health.status === "sick" ||
        agent.health.status === "stressed"
      ) {
        agent.health.status = "recovering";
      }
    }
    this.departmentAgents.set(departmentId, agents);

    // Store donation impact in vector store
    await this.vectorStore.upsert({
      id: `department-donation-${donation.id}`,
      values: await this.vectorStore.createEmbedding(
        `Donation of ${donation.amount} to ${department.name} department improving budget health to ${budgetHealth} and operational efficiency`
      ),
      metadata: {
        type: "district",
        departmentId,
        donationId: donation.id,
        amount: donation.amount,
        budgetHealth,
        efficiencyGain: significantDonation
          ? 0.15
          : (donation.amount / department.budget.total) * 0.1,
        timestamp: donation.timestamp,
      },
    });

    // Emit enhanced donation event with focus on operational improvements
    this.emit("donationReceived", {
      departmentId,
      donation,
      agentImpact: agents.length,
      budgetHealth,
      operationalImprovements: {
        efficiency: department.metrics.efficiency,
        responseTime: department.metrics.responseTime,
        successRate: department.metrics.successRate,
        collaborationScore: department.metrics.collaborationScore,
      },
      agentPerformance: {
        averageEfficiency:
          agents.reduce((sum, agent) => sum + agent.performance.efficiency, 0) /
          agents.length,
        averageResponseTime:
          agents.reduce(
            (sum, agent) => sum + agent.performance.responseTime,
            0
          ) / agents.length,
        averageSatisfaction:
          agents.reduce((sum, agent) => sum + agent.mood.satisfaction, 0) /
          agents.length,
      },
      collaborationScheduled: significantDonation
        ? {
            type: "budget_planning",
            participants: department.assignedAgents.length,
            scheduledTime: Date.now(),
            expectedDuration: "1 hour",
            priority: "high",
          }
        : undefined,
    });

    return { donationId: donation.id };
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
        // Create initial scheduled events
        await this.createInitialScheduledEvents(dept.id, dept.type);
      }
    }

    console.log(`Initialized ${defaultDepartments.length} default departments`);
  }

  private async createDefaultAgentsForDepartment(departmentId: string) {
    const department = await this.getDepartment(departmentId);
    if (!department) return;

    const firstNames = [
      "John",
      "Emma",
      "Michael",
      "Sarah",
      "David",
      "Lisa",
      "James",
      "Maria",
      "Robert",
      "Jennifer",
      "William",
      "Linda",
      "Richard",
      "Patricia",
      "Joseph",
      "Elizabeth",
      "Thomas",
      "Susan",
      "Charles",
      "Jessica",
    ];

    const lastNames = [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Rodriguez",
      "Martinez",
      "Hernandez",
      "Lopez",
      "Gonzalez",
      "Wilson",
      "Anderson",
      "Thomas",
      "Taylor",
      "Moore",
      "Jackson",
      "Martin",
    ];

    const numAgents = Math.floor(Math.random() * 5) + 5; // 5-10 agents per department
    const roles = [
      "field_agent",
      "supervisor",
      "specialist",
      "coordinator",
      "analyst",
    ];

    const usedNames = new Set();

    for (let i = 0; i < numAgents; i++) {
      // Generate unique agent name
      let fullName;
      do {
        const firstName =
          firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName =
          lastNames[Math.floor(Math.random() * lastNames.length)];
        fullName = `${firstName} ${lastName}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      // Create agent ID based on name and department
      const agentId = `${department.type}_${fullName
        .toLowerCase()
        .replace(/\s+/g, "_")}`;
      await this.assignAgent(departmentId, agentId);

      // Update the agent with more specific details
      const agents = await this.getDepartmentAgents(departmentId);
      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        agent.name = fullName;
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

  async initiateCollaboration(
    departmentId: string,
    collaborationData: {
      type: string;
      description: string;
      requiredBudget: number;
      participants: string[];
    }
  ): Promise<boolean> {
    const department = await this.getDepartment(departmentId);
    if (!department) throw new Error("Department not found");

    // Check if department has enough available budget
    const availableBudget = department.budget.total - department.budget.spent;
    if (availableBudget < collaborationData.requiredBudget) {
      // Emit event about insufficient funds
      this.emit("collaborationFailed", {
        departmentId,
        reason: "insufficient_budget",
        required: collaborationData.requiredBudget,
        available: availableBudget,
        timestamp: Date.now(),
      });
      return false;
    }

    // Create collaboration expense
    await this.addExpense(departmentId, {
      id: crypto.randomUUID(),
      amount: collaborationData.requiredBudget,
      category: "operations",
      description: collaborationData.description,
      timestamp: Date.now(),
      approvedBy: "system",
    });

    // Emit collaboration started event
    this.emit("collaborationStarted", {
      departmentId,
      type: collaborationData.type,
      participants: collaborationData.participants,
      budget: collaborationData.requiredBudget,
      timestamp: Date.now(),
    });

    return true;
  }

  async createDepartmentEvent(
    departmentId: string,
    eventData: Omit<
      DepartmentEvent,
      "id" | "status" | "currentBudget" | "metrics"
    >
  ): Promise<DepartmentEvent> {
    const department = await this.getDepartment(departmentId);
    if (!department) throw new Error("Department not found");

    const event: DepartmentEvent = {
      id: crypto.randomUUID(),
      ...eventData,
      status: "pending",
      currentBudget: 0,
      metrics: {
        communityImpact: 0,
        progress: 0,
        participation: 0,
      },
    };

    // Initialize the events array for this department if it doesn't exist
    if (!this.departmentEvents.has(departmentId)) {
      this.departmentEvents.set(departmentId, []);
    }

    // Get current events and add the new one
    const events = this.departmentEvents.get(departmentId) || [];
    events.push(event);
    this.departmentEvents.set(departmentId, events);

    // Store event in vector store for persistence
    await this.vectorStore.upsert({
      id: `dept-event-${event.id}`,
      values: await this.vectorStore.createEmbedding(
        `${event.title} ${event.description} ${event.type}`
      ),
      metadata: {
        type: "department_event",
        departmentId,
        eventId: event.id,
        title: event.title,
        description: event.description,
        eventType: event.type,
        requiredBudget: event.requiredBudget,
        currentBudget: 0,
        status: event.status,
        participants: event.participants.join(","),
        startDate: event.startDate,
        timestamp: Date.now(),
      },
    });

    // Emit event creation
    this.emit("eventCreated", {
      departmentId,
      event,
      timestamp: Date.now(),
    });

    console.log(`Created new event for department ${departmentId}:`, event);
    return event;
  }

  async updateEventProgress(
    eventId: string,
    donation: Donation
  ): Promise<void> {
    for (const [departmentId, events] of this.departmentEvents) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        event.currentBudget += donation.amount;

        // Update progress
        event.metrics.progress = Math.min(
          1,
          event.currentBudget / event.requiredBudget
        );

        // If enough budget is collected, mark as in progress or complete
        if (event.currentBudget >= event.requiredBudget) {
          event.status = "in_progress";

          // Start the event activities
          await this.startEventActivities(event);
        }

        // Update event in the map
        this.departmentEvents.set(departmentId, events);

        // Emit progress update
        this.emit("eventProgressUpdated", {
          departmentId,
          eventId,
          currentBudget: event.currentBudget,
          progress: event.metrics.progress,
          status: event.status,
          timestamp: Date.now(),
        });

        break;
      }
    }
  }

  private async startEventActivities(event: DepartmentEvent): Promise<void> {
    // Get participating agents
    const agents = await this.getDepartmentAgents(event.departmentId);
    const participants = agents.filter((a) =>
      event.participants.includes(a.id)
    );

    // Boost agent moods and motivation more significantly
    for (const agent of participants) {
      agent.mood.enthusiasm = Math.min(1, agent.mood.enthusiasm + 0.3);
      agent.mood.satisfaction = Math.min(1, agent.mood.satisfaction + 0.25);
      agent.health.motivation = Math.min(1, agent.health.motivation + 0.2);
      agent.health.energy = Math.min(1, agent.health.energy + 0.15);
      agent.performance.efficiency = Math.min(
        1,
        agent.performance.efficiency + 0.1
      );
    }

    // Update department metrics based on event type with enhanced impacts
    const department = await this.getDepartment(event.departmentId);
    if (department) {
      switch (event.type) {
        case "infrastructure":
          department.metrics.efficiency += 0.08;
          department.metrics.responseTime -= 0.05;
          department.metrics.successRate += 0.03;
          break;
        case "cultural":
          department.metrics.collaborationScore += 0.08;
          department.metrics.successRate += 0.04;
          department.metrics.efficiency += 0.02;
          break;
        case "educational":
          department.metrics.successRate += 0.08;
          department.metrics.collaborationScore += 0.05;
          department.metrics.efficiency += 0.04;
          break;
        case "environmental":
          department.metrics.efficiency += 0.06;
          department.metrics.collaborationScore += 0.06;
          department.metrics.successRate += 0.04;
          break;
        case "social":
          department.metrics.collaborationScore += 0.08;
          department.metrics.responseTime -= 0.04;
          department.metrics.successRate += 0.05;
          break;
      }

      // Normalize metrics
      department.metrics = Object.fromEntries(
        Object.entries(department.metrics).map(([key, value]) => [
          key,
          Math.min(1, Math.max(0, value)),
        ])
      ) as typeof department.metrics;

      // Update department in the map
      this.departments.set(event.departmentId, department);

      // Emit metrics update
      this.emit("departmentMetricsUpdated", {
        departmentId: event.departmentId,
        metrics: department.metrics,
        eventType: event.type,
        timestamp: Date.now(),
      });
    }

    // Emit event started with more details
    this.emit("eventStarted", {
      departmentId: event.departmentId,
      event,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        performance: p.performance,
      })),
      expectedImpact: {
        communityWellbeing: 0.1,
        departmentEfficiency: 0.08,
        agentMotivation: 0.2,
      },
      timestamp: Date.now(),
    });
  }

  private async initializeDefaultEvents() {
    const defaultEvents: Omit<
      DepartmentEvent,
      "id" | "status" | "currentBudget" | "metrics"
    >[] = [
      // Infrastructure Events
      {
        type: "infrastructure",
        title: "Smart Traffic System Implementation",
        description:
          "Implement AI-powered traffic management system to reduce congestion and improve traffic flow",
        requiredBudget: 500000,
        departmentId: "transportation-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      {
        type: "infrastructure",
        title: "Emergency Response Center Upgrade",
        description:
          "Modernize emergency response center with advanced communication systems",
        requiredBudget: 750000,
        departmentId: "emergency-response-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },

      // Cultural Events
      {
        type: "cultural",
        title: "Community Arts Festival",
        description:
          "Organize a district-wide arts and culture festival celebrating local talent",
        requiredBudget: 150000,
        departmentId: "social-services-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      {
        type: "cultural",
        title: "Heritage Preservation Project",
        description:
          "Restore and preserve historical landmarks in the district",
        requiredBudget: 300000,
        departmentId: "urban-planning-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },

      // Environmental Events
      {
        type: "environmental",
        title: "Green Energy Initiative",
        description:
          "Install solar panels in public buildings and implement smart grid solutions",
        requiredBudget: 300000,
        departmentId: "environmental-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      {
        type: "environmental",
        title: "Urban Forest Development",
        description:
          "Create new green spaces and plant trees throughout the district",
        requiredBudget: 200000,
        departmentId: "environmental-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },

      // Educational Events
      {
        type: "educational",
        title: "Digital Learning Centers",
        description:
          "Establish community digital learning centers with free internet access",
        requiredBudget: 400000,
        departmentId: "education-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      {
        type: "educational",
        title: "Youth Innovation Program",
        description:
          "Launch a program to teach coding and entrepreneurship to young residents",
        requiredBudget: 250000,
        departmentId: "education-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },

      // Social Events
      {
        type: "social",
        title: "Community Health Initiative",
        description:
          "Provide free health screenings and wellness programs for residents",
        requiredBudget: 350000,
        departmentId: "healthcare-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      {
        type: "social",
        title: "Senior Care Program",
        description:
          "Establish support services and social activities for elderly residents",
        requiredBudget: 280000,
        departmentId: "social-services-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      // Economy Department Events
      {
        type: "infrastructure",
        title: "Economic Development Hub",
        description:
          "Create a centralized hub for economic development and business support",
        requiredBudget: 600000,
        departmentId: "economy-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
      {
        type: "social",
        title: "Business Innovation Forum",
        description:
          "Organize a forum for local businesses to share ideas and innovations",
        requiredBudget: 150000,
        departmentId: "economy-dept",
        districtId: "central-district",
        participants: ["sophia", "raj", "vision", "nexus"],
        startDate: Date.now(),
      },
    ];

    console.log("Initializing default events...");
    for (const eventData of defaultEvents) {
      try {
        const event = await this.createDepartmentEvent(
          eventData.departmentId,
          eventData
        );
        console.log(
          `Created event: ${event.title} for department: ${event.departmentId}`
        );
      } catch (error) {
        console.error(
          `Failed to create event ${eventData.title} for department ${eventData.departmentId}:`,
          error
        );
      }
    }
    console.log("Finished initializing default events");
  }

  async getDepartmentEvents(departmentId: string): Promise<DepartmentEvent[]> {
    return this.departmentEvents.get(departmentId) || [];
  }

  private async createInitialScheduledEvents(
    departmentId: string,
    type: DepartmentType
  ) {
    const events: CityEvent[] = [
      {
        id: crypto.randomUUID(),
        title: `${type} Monthly Planning Session`,
        description:
          "Monthly strategic planning and coordination meeting to discuss department goals and initiatives.",
        category: "development" as CityEventCategory,
        severity: 0.6,
        duration: 2, // 2 hours
        urgency: 0.7,
        impact: {
          environmental: 0.4,
          social: 0.8,
          economic: 0.7,
        },
        requiredAgents: [], // Will be filled by agent selection
        affectedDistricts: [departmentId],
        status: "pending",
        timestamp: Date.now(), // Start immediately
      },
      {
        id: crypto.randomUUID(),
        title: `${type} Emergency Response Training`,
        description:
          "Collaborative training session to improve emergency response coordination and effectiveness.",
        category: "emergency" as CityEventCategory,
        severity: 0.8,
        duration: 3, // 3 hours
        urgency: 0.9,
        impact: {
          environmental: 0.5,
          social: 0.9,
          economic: 0.6,
        },
        requiredAgents: [], // Will be filled by agent selection
        affectedDistricts: [departmentId],
        status: "pending",
        timestamp: Date.now() + 60 * 60 * 1000, // Start in 1 hour
      },
    ];

    // Store events in vector store
    for (const event of events) {
      // Add default participants based on department type
      const defaultParticipants = ["planner", "services", "max"];
      event.requiredAgents = [
        ...new Set([...event.requiredAgents, ...defaultParticipants]),
      ];

      await this.vectorStore.upsert({
        id: `scheduled-collab-${event.id}`,
        values: await this.vectorStore.createEmbedding(
          `${event.title} ${event.description} ${event.category}`
        ),
        metadata: {
          type: "collaboration",
          subtype: "scheduled",
          departmentId,
          eventId: event.id,
          sessionId: event.id,
          topic: event.title,
          participants: event.requiredAgents.filter(Boolean).join(","),
          title: event.title,
          description: event.description,
          category: event.category,
          severity: event.severity,
          urgency: event.urgency,
          timestamp: event.timestamp,
          status: "scheduled",
          duration: event.duration,
          impact: JSON.stringify(event.impact),
          consensusLevel: "0",
          participation: "0",
          effectiveness: "0",
        },
      });

      // Initiate collaboration session immediately
      await this.collaborationService.initiateCollaboration(event);

      // Emit collaboration started event
      this.emit("collaborationStarted", {
        departmentId,
        type: event.category,
        title: event.title,
        description: event.description,
        timestamp: event.timestamp,
        severity: event.severity,
        urgency: event.urgency,
        impact: event.impact,
        duration: event.duration,
        status: "scheduled",
        participants: event.requiredAgents,
      });
    }
  }

  private async initializePeriodicActivities() {
    console.log("🔄 Initializing periodic department activities...");

    // Generate initial activities
    await this.generateDepartmentActivities();
    console.log("✅ Initial department activities generated successfully");

    // Then set up periodic generation every 30 minutes
    setInterval(async () => {
      console.log("🔄 Generating periodic department activities...");
      try {
        await this.generateDepartmentActivities();
        console.log("✅ Department activities generated successfully");
      } catch (error) {
        console.error("❌ Failed to generate department activities:", error);
      }
    }, 30 * 60 * 1000);
  }

  private calculateAverageAgentHealth(
    agents: DepartmentAgent[]
  ): AgentHealthMetrics {
    if (!agents.length) {
      return {
        physical: 0.8,
        mental: 0.8,
        energy: 0.8,
        motivation: 0.8,
        happiness: 0.8,
        satisfaction: 0.8,
        stress: 0.2,
      };
    }

    return {
      physical:
        agents.reduce((sum, agent) => sum + agent.health.physical, 0) /
        agents.length,
      mental:
        agents.reduce((sum, agent) => sum + agent.health.mental, 0) /
        agents.length,
      energy:
        agents.reduce((sum, agent) => sum + agent.health.energy, 0) /
        agents.length,
      motivation:
        agents.reduce((sum, agent) => sum + agent.health.motivation, 0) /
        agents.length,
      happiness:
        agents.reduce((sum, agent) => sum + agent.mood.happiness, 0) /
        agents.length,
      satisfaction:
        agents.reduce((sum, agent) => sum + agent.mood.satisfaction, 0) /
        agents.length,
      stress:
        agents.reduce((sum, agent) => sum + agent.mood.stress, 0) /
        agents.length,
    };
  }

  private async generateDepartmentActivities() {
    const departments = await this.getAllDepartments();

    for (const department of departments) {
      // Generate 3 activities per department
      for (let i = 0; i < 3; i++) {
        // Generate activity description using together service
        const prompt = `Generate a realistic and detailed activity description for the ${department.name} in an AI city. The activity should:
        - Be written in present tense
        - Include specific actions taken by department agents
        - Mention the impact on the city and its citizens
        - Reference collaboration with other departments if relevant
        - Include quantifiable metrics or outcomes where possible
        
        Format: Just the activity description in a single paragraph, no additional text.`;

        const activityDescription = await this.togetherService.generateText(
          prompt
        );

        // Get department agents for health metrics
        const agents = await this.getDepartmentAgents(department.id);
        const avgAgentHealth = this.calculateAverageAgentHealth(agents);

        // Calculate budget health
        const budgetHealth =
          department.budget.total > 0
            ? (department.budget.total - department.budget.spent) /
              department.budget.total
            : 0.8;

        // Store in vector store with unique ID
        const activityId = `activity-${department.id}-${Date.now()}-${i}`;
        const embedding = await this.vectorStore.createEmbedding(
          activityDescription
        );

        await this.vectorStore.upsert({
          id: activityId,
          values: embedding,
          metadata: {
            type: "district",
            departmentId: department.id,
            activityType: "department_activity",
            timestamp: Date.now(),
            details: JSON.stringify({
              description: activityDescription,
              agentHealth: avgAgentHealth,
              budgetHealth: budgetHealth,
              metrics: department.metrics,
            }),
          },
        });

        // Emit activity added event
        this.emit("activityAdded", {
          departmentId: department.id,
          activity: {
            id: activityId,
            type: "department_activity",
            description: activityDescription,
            timestamp: Date.now(),
            metrics: {
              agentHealth: avgAgentHealth,
              budgetHealth: budgetHealth,
              departmentMetrics: department.metrics,
            },
          },
        });
      }
    }
  }
}
