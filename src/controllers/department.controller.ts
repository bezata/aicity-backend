import { Elysia, t } from "elysia";
import type { AppStore } from "../services/app.services";
import { Department, DepartmentType } from "../types/department.types";

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
  );
