import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { version } from "../../package.json";

export const SwaggerPlugin = new Elysia().use(
  swagger({
    documentation: {
      info: {
        title: "AI Chatroom API",
        version,
        description:
          "API for managing AI agent conversations with memory and real-time updates",
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT",
        },
        contact: {
          name: "API Support",
          email: "support@example.com",
          url: "https://github.com/yourusername/ai-chatroom",
        },
      },
      tags: [
        {
          name: "Agents",
          description: "AI agent management endpoints",
        },
        {
          name: "Conversations",
          description: "Conversation management and real-time chat",
        },
        {
          name: "AI",
          description: "AI interaction and response generation",
        },
        {
          name: "System",
          description: "System health and monitoring",
        },
      ],
      servers: [
        {
          url: "http://localhost:3000",
          description: "Local development",
        },
        {
          url: "https://api.example.com",
          description: "Production server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Enter your JWT token",
          },
        },
        schemas: {
          Error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
          HealthCheck: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
      externalDocs: {
        description: "Additional Documentation",
        url: "https://github.com/yourusername/ai-chatroom/docs",
      },
      security: [{ bearerAuth: [] }],
      paths: {
        "/health": {
          get: {
            tags: ["System"],
            summary: "Check API health",
            description: "Returns the current status of the API",
            responses: {
              "200": {
                description: "API is healthy",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/HealthCheck",
                    },
                    example: {
                      status: "ok",
                      version: "1.0.0",
                      timestamp: "2024-04-13T12:00:00.000Z",
                    },
                  },
                },
              },
            },
          },
        },
        "/ai/chat/{conversationId}/{agentId}": {
          get: {
            tags: ["AI"],
            summary: "Generate AI response",
            description:
              "Streams an AI response for the given conversation and agent",
            parameters: [
              {
                name: "conversationId",
                in: "path",
                required: true,
                schema: { type: "string" },
                description: "Unique conversation identifier",
              },
              {
                name: "agentId",
                in: "path",
                required: true,
                schema: { type: "string" },
                description: "ID of the AI agent",
              },
            ],
            responses: {
              "200": {
                description: "Streamed AI response",
                content: {
                  "text/event-stream": {
                    schema: {
                      type: "string",
                    },
                  },
                },
              },
              "404": {
                description: "Agent not found",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/Error",
                    },
                  },
                },
              },
            },
          },
        },
        "/agents": {
          get: {
            tags: ["Agents"],
            summary: "List all agents",
            description: "Returns a list of all available AI agents",
            responses: {
              "200": {
                description: "List of agents",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Agent",
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            tags: ["Agents"],
            summary: "Create new agent",
            description:
              "Creates a new AI agent with the specified configuration",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AgentCreate",
                  },
                },
              },
            },
            responses: {
              "201": {
                description: "Agent created successfully",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/Agent",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    path: "/docs",
    theme: "default",
  })
);
