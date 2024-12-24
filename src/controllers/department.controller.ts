import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import { Department, DepartmentType } from "../types/department.types";
import { AgentHealth, AgentMood } from "../types/department-agent.types";
import {
  VectorRecord,
  TextVectorQuery,
  VectorQuery,
} from "../types/vector-store.types";

interface PerformanceMetrics {
  efficiency: number;
  responseTime: number;
  successRate: number;
  collaborationScore: number;
}

interface AgentHealthMetrics {
  physical: number;
  mental: number;
  energy: number;
  motivation: number;
  happiness: number;
  satisfaction: number;
  stress: number;
}

interface PerformanceRecord {
  timestamp: number;
  metrics: PerformanceMetrics;
  agentHealth: AgentHealthMetrics;
  budgetHealth: number;
}

interface PerformanceMetadata {
  type: "district";
  departmentId: string;
  timestamp: number;
  metrics: string;
  agentHealth: string;
  budgetHealth: number;
}

export const DepartmentController = new Elysia({ prefix: "/departments" })
  .get("/", async ({ store }) => {
    const appStore = store as AppStore;
    return await appStore.services.departmentService.getAllDepartments();
  })
  .post(
    "/",
    async ({ body, store }) => {
      const appStore = store as AppStore;
      const department: Department = {
        id: crypto.randomUUID(),
        ...body,
        assignedAgents: [],
        activeChats: [],
        currentProjects: [],
        metrics: {
          efficiency: 0.8,
          responseTime: 0.7,
          successRate: 0.9,
          collaborationScore: 0.8,
        },
        budget: {
          total: 0,
          allocated: 0,
          spent: 0,
          donations: 0,
          expenses: [],
          donations_history: [],
        },
      };
      return await appStore.services.departmentService.createDepartment(
        department
      );
    },
    {
      body: t.Object({
        name: t.String(),
        type: t.Union([
          t.Literal("emergency_response"),
          t.Literal("urban_planning"),
          t.Literal("public_safety"),
          t.Literal("environmental"),
          t.Literal("infrastructure"),
          t.Literal("social_services"),
          t.Literal("transportation"),
        ]),
        description: t.String(),
      }),
    }
  )
  .post(
    "/:id/agents",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      return await appStore.services.departmentService.assignAgent(
        id,
        body.agentId
      );
    },
    {
      body: t.Object({
        agentId: t.String(),
      }),
    }
  )
  .post(
    "/:id/chat",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      const chatId =
        await appStore.services.departmentService.createDepartmentChat(
          id,
          body.topic,
          body.participants
        );
      return { chatId };
    },
    {
      body: t.Object({
        topic: t.String(),
        participants: t.Array(t.String()),
      }),
    }
  )
  .post(
    "/:id/budget/donate",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      return await appStore.services.departmentService.addDonation(id, {
        id: crypto.randomUUID(),
        amount: body.amount,
        donorId: body.donorId,
        message: body.message,
        timestamp: Date.now(),
        transactionHash: body.transactionHash,
      });
    },
    {
      body: t.Object({
        amount: t.Number(),
        donorId: t.Optional(t.String()),
        message: t.Optional(t.String()),
        transactionHash: t.Optional(t.String()),
      }),
    }
  )
  .get("/:id/budget", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    return await appStore.services.departmentService.getDepartmentBudget(id);
  })
  .post(
    "/:id/budget/expense",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      return await appStore.services.departmentService.addExpense(id, {
        id: crypto.randomUUID(),
        amount: body.amount,
        category: body.category,
        description: body.description,
        timestamp: Date.now(),
        approvedBy: body.approvedBy,
      });
    },
    {
      body: t.Object({
        amount: t.Number(),
        category: t.Union([
          t.Literal("equipment"),
          t.Literal("personnel"),
          t.Literal("operations"),
          t.Literal("maintenance"),
          t.Literal("emergency"),
        ]),
        description: t.String(),
        approvedBy: t.String(),
      }),
    }
  )
  .get("/:id/agents/health", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    const agents =
      await appStore.services.departmentService.getDepartmentAgents(id);
    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      health: agent.health,
      mood: agent.mood,
      donationImpact: agent.donationImpact,
    }));
  })
  .get("/:id/agents/stats", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    const agents =
      await appStore.services.departmentService.getDepartmentAgents(id);

    const stats = {
      totalAgents: agents.length,
      healthStatus: {
        healthy: 0,
        tired: 0,
        stressed: 0,
        sick: 0,
        recovering: 0,
      },
      averages: {
        physical: 0,
        mental: 0,
        energy: 0,
        motivation: 0,
        happiness: 0,
        satisfaction: 0,
        enthusiasm: 0,
        stress: 0,
      },
    };

    for (const agent of agents) {
      // Count health statuses
      stats.healthStatus[agent.health.status]++;

      // Sum up health metrics
      stats.averages.physical += agent.health.physical;
      stats.averages.mental += agent.health.mental;
      stats.averages.energy += agent.health.energy;
      stats.averages.motivation += agent.health.motivation;

      // Sum up mood metrics
      stats.averages.happiness += agent.mood.happiness;
      stats.averages.satisfaction += agent.mood.satisfaction;
      stats.averages.enthusiasm += agent.mood.enthusiasm;
      stats.averages.stress += agent.mood.stress;
    }

    // Calculate averages
    if (agents.length > 0) {
      const averages = stats.averages as { [key: string]: number };
      for (const key in averages) {
        averages[key] = averages[key] / agents.length;
      }
    }

    return stats;
  })
  .post(
    "/:id/agents/:agentId/heal",
    async ({ params: { id, agentId }, body, store }) => {
      const appStore = store as AppStore;
      return await appStore.services.departmentService.healAgent(id, agentId, {
        treatment: body.treatment,
        duration: body.duration,
        cost: body.cost,
      });
    },
    {
      body: t.Object({
        treatment: t.String(),
        duration: t.Number(),
        cost: t.Number(),
      }),
    }
  )
  .get("/:id/performance/history", async ({ params: { id }, query, store }) => {
    const appStore = store as AppStore;
    const department = await appStore.services.departmentService.getDepartment(
      id
    );
    if (!department) throw new Error("Department not found");

    const textQuery = `Department ${department.name} performance update`;
    const vector = await appStore.services.vectorStore.createEmbedding(
      textQuery
    );

    const vectorQuery: VectorQuery<PerformanceMetadata> = {
      vector,
      filter: {
        type: { $eq: "district" },
        departmentId: { $eq: id },
      },
      limit: 100,
    };

    const records = await appStore.services.vectorStore.query(vectorQuery);

    // Parse and format performance history
    const history = (records.matches || [])
      .map((record: VectorRecord<PerformanceMetadata>) => ({
        timestamp: record.metadata.timestamp,
        metrics: JSON.parse(record.metadata.metrics) as PerformanceMetrics,
        agentHealth: JSON.parse(
          record.metadata.agentHealth
        ) as AgentHealthMetrics,
        budgetHealth: record.metadata.budgetHealth,
      }))
      .sort(
        (a: PerformanceRecord, b: PerformanceRecord) =>
          b.timestamp - a.timestamp
      );

    return {
      departmentId: id,
      departmentName: department.name,
      performanceHistory: history,
    };
  })
  .get("/:id/events", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;
    const events =
      await appStore.services.departmentService.getDepartmentEvents(id);
    return events;
  })
  .post(
    "/:id/events",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      return await appStore.services.departmentService.createDepartmentEvent(
        id,
        {
          type: body.type,
          title: body.title,
          description: body.description,
          requiredBudget: body.requiredBudget,
          departmentId: id,
          districtId: body.districtId,
          participants: body.participants,
          startDate: Date.now(),
        }
      );
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("infrastructure"),
          t.Literal("cultural"),
          t.Literal("educational"),
          t.Literal("environmental"),
          t.Literal("social"),
        ]),
        title: t.String(),
        description: t.String(),
        requiredBudget: t.Number(),
        districtId: t.String(),
        participants: t.Array(t.String()),
      }),
    }
  )
  .post(
    "/:id/events/:eventId/donate",
    async ({ params: { id, eventId }, body, store }) => {
      const appStore = store as AppStore;

      // First process the donation through department
      await appStore.services.departmentService.addDonation(id, {
        id: crypto.randomUUID(),
        amount: body.amount,
        donorId: body.donorId,
        message: body.message,
        timestamp: Date.now(),
        transactionHash: body.transactionHash,
      });

      // Then update the event progress
      await appStore.services.departmentService.updateEventProgress(eventId, {
        id: crypto.randomUUID(),
        amount: body.amount,
        donorId: body.donorId || "anonymous",
        message: body.message || "",
        timestamp: Date.now(),
        transactionHash: body.transactionHash || "",
      });

      return { success: true };
    },
    {
      body: t.Object({
        amount: t.Number(),
        donorId: t.Optional(t.String()),
        message: t.Optional(t.String()),
        transactionHash: t.Optional(t.String()),
      }),
    }
  )
  .ws("/events/subscribe", {
    open(ws: any) {
      const appStore = ws.data.store as AppStore;
      const departmentService = appStore.services.departmentService;

      // Listen for event updates
      departmentService.on("eventCreated", (data) => {
        ws.send({ type: "event_created", data });
      });

      departmentService.on("eventProgressUpdated", (data) => {
        ws.send({ type: "event_progress", data });
      });

      departmentService.on("eventStarted", (data) => {
        ws.send({ type: "event_started", data });
      });

      departmentService.on("departmentMetricsUpdated", (data) => {
        ws.send({ type: "metrics_updated", data });
      });
    },
    message(ws, message) {
      // Handle any incoming messages if needed
    },
  });
