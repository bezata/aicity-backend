import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { websocket } from "@elysiajs/websocket";
import { SwaggerPlugin } from "./plugins/swagger.plugin";
import { AIController } from "./controllers/ai.controller";
import { AgentController } from "./controllers/agent.controller";
import { ConversationController } from "./controllers/conversation.controller";

const app = new Elysia()
  .use(cors())
  .use(websocket())
  .use(SwaggerPlugin)

  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }))
  .group("/api/v1", (app) =>
    app.use(AIController).use(AgentController).use(ConversationController)
  )
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);

    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return { error: "Validation Error", message: error.message };

      case "NOT_FOUND":
        set.status = 404;
        return { error: "Not Found", message: "Resource not found" };

      default:
        set.status = 500;
        return {
          error: "Internal Server Error",
          message: "Something went wrong",
        };
    }
  })
  .listen(process.env.PORT || 3000, () => {
    console.log(`🦊 Server is running at http://localhost:${app.server?.port}`);
    console.log(
      `📚 Swagger documentation at http://localhost:${app.server?.port}/docs`
    );
  });

export type App = typeof app;
