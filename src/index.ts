import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { AIController } from "./controllers/ai.controller";
import { AgentController } from "./controllers/agent.controller";
import { ConversationController } from "./controllers/conversation.controller";
import { swagger } from "@elysiajs/swagger";

const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:3001"], // Your frontend URL
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  )
  .use(swagger())
  .get("/", () => ({
    message: "Welcome to AI City Backend API",
    docs: "/swagger",
    health: "/health",
    version: "1.0.0",
  }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }))
  .onRequest(({ request }) => {
    console.log(`\n🌐 [${new Date().toISOString()}]`);
    console.log(`📍 ${request.method} ${request.url}`);
  })

  // Add error logging
  .onError(({ code, error }) => {
    console.error(`❌ Error [${code}]:`, error);
    return {
      error: error.message,
      code,
    };
  })
  .use(AIController)
  .use(AgentController)
  .use(ConversationController)
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);
    set.status = code === "NOT_FOUND" ? 404 : 500;
    return {
      error: error.message,
      status: set.status,
    };
  })
  .listen(3000);

console.log(
  `🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`
);
