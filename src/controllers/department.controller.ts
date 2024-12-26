import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import { Department, DepartmentType } from "../types/department.types";
import { AgentHealth, AgentMood } from "../types/department-agent.types";
import {
  VectorRecord,
  TextVectorQuery,
  VectorQuery,
} from "../types/vector-store.types";
import { CityEvent } from "../types/city-events";

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

    const textQuery = `Department ${department.name} activity`;
    const vector = await appStore.services.vectorStore.createEmbedding(
      textQuery
    );

    const vectorQuery = {
      vector,
      filter: {
        type: { $eq: "district" },
        departmentId: { $eq: id },
        activityType: { $eq: "department_activity" },
      },
      limit: 100,
    };

    const records = await appStore.services.vectorStore.query(vectorQuery);

    interface ActivityRecord {
      timestamp: number;
      description: string;
      metrics: {
        efficiency: number;
        responseTime: number;
        successRate: number;
        collaborationScore: number;
      };
      agentHealth: {
        physical: number;
        mental: number;
        energy: number;
        motivation: number;
        happiness: number;
        satisfaction: number;
        stress: number;
      };
      budgetHealth: number;
    }

    // Parse and format performance history with error handling
    const history = (records.matches || [])
      .map((record: VectorRecord<any>) => {
        try {
          const details = JSON.parse(record.metadata.details || "{}");
          return {
            timestamp: record.metadata.timestamp || Date.now(),
            description: details.description || "",
            metrics: details.metrics || {
              efficiency: 0.8,
              responseTime: 0.7,
              successRate: 0.9,
              collaborationScore: 0.8,
            },
            agentHealth: details.agentHealth || {
              physical: 0.8,
              mental: 0.8,
              energy: 0.8,
              motivation: 0.8,
              happiness: 0.8,
              satisfaction: 0.8,
              stress: 0.2,
            },
            budgetHealth: details.budgetHealth || 0.8,
          } as ActivityRecord;
        } catch (error) {
          console.error("Error parsing performance record:", error);
          return null;
        }
      })
      .filter(Boolean)
      .sort(
        (a: ActivityRecord, b: ActivityRecord) => b.timestamp - a.timestamp
      );

    return {
      success: true,
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
  })
  .get("/active", async ({ store }) => {
    const appStore = store as AppStore;
    const departments =
      await appStore.services.departmentService.getAllDepartments();

    // Filter active departments based on recent activity and metrics
    const activeDepartments = departments.filter((dept) => {
      const hasRecentActivity =
        dept.activeChats.length > 0 || dept.currentProjects.length > 0;
      const isEfficient = dept.metrics.efficiency > 0.7;
      const hasGoodResponse = dept.metrics.responseTime > 0.7;
      return hasRecentActivity || (isEfficient && hasGoodResponse);
    });

    return activeDepartments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      type: dept.type,
      metrics: dept.metrics,
      activeChats: dept.activeChats.length,
      currentProjects: dept.currentProjects.length,
      budget: {
        total: dept.budget.total,
        available: dept.budget.total - dept.budget.spent,
        efficiency: (dept.budget.total - dept.budget.spent) / dept.budget.total,
      },
    }));
  })
  .get("/:id/collaboration-history", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;

    // Create embedding for the department's collaboration query
    const embedding = await appStore.services.vectorStore.createEmbedding(
      `Department ${id} collaboration sessions and discussions`
    );

    // Query vector store for collaboration history
    const results = await appStore.services.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "collaboration" },
        departmentId: { $eq: id },
      },
      topK: 50,
    });

    return results.matches.map(
      (
        match: VectorRecord<{
          sessionId: string;
          topic: string;
          participants: string;
          timestamp: string;
          decisions: string;
          outcome: string;
          consensusLevel: string;
          participation: string;
          effectiveness: string;
        }>
      ) => ({
        sessionId: match.metadata.sessionId,
        topic: match.metadata.topic,
        participants: match.metadata.participants?.split(",") || [],
        timestamp: match.metadata.timestamp,
        decisions: match.metadata.decisions,
        outcome: match.metadata.outcome,
        metrics: {
          consensusLevel: parseFloat(match.metadata.consensusLevel || "0"),
          participation: parseFloat(match.metadata.participation || "0"),
          effectiveness: parseFloat(match.metadata.effectiveness || "0"),
        },
      })
    );
  })
  .post(
    "/:id/schedule-collaboration",
    async ({ params: { id }, body, store }) => {
      const appStore = store as AppStore;
      const department =
        await appStore.services.departmentService.getDepartment(id);
      if (!department) throw new Error("Department not found");

      // Create collaboration event
      const collaborationEvent = {
        id: crypto.randomUUID(),
        title: body.title,
        description: body.description,
        category: body.category,
        severity: 0.5,
        urgency: 0.6,
        duration: body.duration || 3600000, // Default 1 hour
        impact: {
          social: body.impact?.social || 0.7,
          economic: body.impact?.economic || 0.6,
          cultural: body.impact?.cultural || 0.5,
          environmental: body.impact?.environmental || 0.4,
        },
        affectedDistricts: [body.districtId || "central-district"],
        requiredAgents: body.agentIds || ["planner", "services", "max"],
        timestamp: body.scheduledTime || Date.now(),
        status: "pending" as const,
      };

      // Store collaboration details in vector store
      await appStore.services.vectorStore.upsert({
        id: `collab-schedule-${collaborationEvent.id}`,
        values: await appStore.services.vectorStore.createEmbedding(
          `${collaborationEvent.title} ${collaborationEvent.description} scheduled for department ${department.name}`
        ),
        metadata: {
          type: "collaboration",
          departmentId: id,
          sessionId: collaborationEvent.id,
          topic: collaborationEvent.title,
          participants: collaborationEvent.requiredAgents
            .filter(Boolean)
            .join(","),
          timestamp: collaborationEvent.timestamp,
          category: collaborationEvent.category,
          status: "scheduled",
          consensusLevel: "0",
          participation: "0",
          effectiveness: "0",
        },
      });

      // Initiate collaboration
      await appStore.services.collaborationService.initiateCollaboration(
        collaborationEvent
      );

      return {
        collaborationId: collaborationEvent.id,
        scheduledTime: collaborationEvent.timestamp,
        participants: collaborationEvent.requiredAgents,
        status: "scheduled",
      };
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.String(),
        category: t.Union([
          t.Literal("development"),
          t.Literal("cultural"),
          t.Literal("emergency"),
          t.Literal("social"),
          t.Literal("transport"),
          t.Literal("environmental"),
          t.Literal("community"),
        ]),
        duration: t.Optional(t.Number()),
        scheduledTime: t.Optional(t.Number()),
        districtId: t.Optional(t.String()),
        agentIds: t.Optional(t.Array(t.String())),
        impact: t.Optional(
          t.Object({
            social: t.Number(),
            economic: t.Number(),
            cultural: t.Number(),
            environmental: t.Number(),
          })
        ),
      }),
    }
  )
  .get("/:id/scheduled-collaborations", async ({ params: { id }, store }) => {
    const appStore = store as AppStore;

    // Query vector store for scheduled collaborations
    const embedding = await appStore.services.vectorStore.createEmbedding(
      `Department ${id} scheduled collaboration sessions`
    );

    const results = await appStore.services.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "collaboration" },
        departmentId: { $eq: id },
        status: { $eq: "scheduled" },
      },
      topK: 20,
    });

    return results.matches.map(
      (
        match: VectorRecord<{
          sessionId: string;
          topic: string;
          participants: string;
          timestamp: string;
          category: string;
          status: string;
        }>
      ) => ({
        sessionId: match.metadata.sessionId,
        topic: match.metadata.topic,
        participants: match.metadata.participants?.split(",") || [],
        scheduledTime: parseInt(match.metadata.timestamp),
        category: match.metadata.category,
        status: match.metadata.status,
      })
    );
  })
  .post(
    "/collaborate/:departmentId",
    async ({ params: { departmentId }, store }) => {
      const appStore = store as AppStore;

      // Create collaboration event for department
      const collaborationEvent: CityEvent = {
        id: crypto.randomUUID(),
        title: `${departmentId} Department Strategic Planning`,
        description:
          "Monthly department collaboration for strategic planning and coordination",
        category: "development",
        severity: 0.7,
        duration: 2, // 2 hours
        urgency: 0.7,
        impact: {
          environmental: 0.5,
          social: 0.8,
          economic: 0.7,
        },
        requiredAgents: ["sophia", "raj", "vision", "nexus"], // Using correct agents from config
        affectedDistricts: [departmentId],
        status: "pending",
        timestamp: Date.now(),
      };

      try {
        // Initiate collaboration using the better mechanism
        const sessionId =
          await appStore.services.collaborationService.initiateCollaboration(
            collaborationEvent
          );

        // Get session status after messages are generated
        const sessionStatus =
          await appStore.services.collaborationService.getSessionStatus(
            sessionId
          );

        return {
          success: true,
          data: sessionStatus,
        };
      } catch (error) {
        console.error("Failed to initiate department collaboration:", error);
        throw error;
      }
    }
  );
