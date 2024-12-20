import { EventEmitter } from "events";
import {
  Department,
  DepartmentBudget,
  Donation,
  BudgetExpense,
} from "../types/department.types";
import { VectorStoreService } from "./vector-store.service";
import { TogetherService } from "./together.service";

export interface DepartmentActivity {
  type: string;
  timestamp: number;
  [key: string]: any;
}

export class DepartmentService extends EventEmitter {
  private departments: Map<string, Department> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService
  ) {
    super();
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

    this.emit("donationReceived", { departmentId, donation });
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
}
