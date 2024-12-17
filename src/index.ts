import { Elysia } from "elysia";
import { AIController } from "./controllers/ai.controller";
import { AgentController } from "./controllers/agent.controller";
import { ConversationController } from "./controllers/conversation.controller";
import { ChatController } from "./controllers/chat.controller";
import { swagger } from "@elysiajs/swagger";
import { createStore, AppStore } from "./services/app.services";
import { CityController } from "./controllers/city.controller";

const app = new Elysia()
  .use(swagger())
  .state(createStore())
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
  .get("/service-worker.js", () => {
    return new Response("", { status: 204 });
  })
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
  .use(CityController)
  .use(AgentController)
  .use(ConversationController)
  .use(ChatController)
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);
    if (error.message.includes("timeout")) {
      set.status = 504;
      return {
        error: "Request timed out",
        status: 504,
      };
    }
    set.status = code === "NOT_FOUND" ? 404 : 500;
    return {
      error: error.message,
      status: set.status,
    };
  })
  .listen(3001);

console.log(
  `🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`
);

// Add this to your shutdown handling
process.on("SIGTERM", async () => {
  const store = app.store as AppStore;
  await store.services.vectorStore.close();
  process.exit(0);
});
