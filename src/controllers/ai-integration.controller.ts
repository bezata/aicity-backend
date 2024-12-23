import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { AIIntegrationService } from "../services/ai-integration.service";

// Define request schemas
const InitializeRequestSchema = t.Object({
  systemKey: t.String(),
  config: t.Object({
    agents: t.Array(t.String()),
    protocol: t.Object({
      name: t.String(),
      version: t.String(),
      rules: t.Array(t.String()),
    }),
    initialState: t.Optional(t.Record(t.String(), t.Any())),
  }),
});

export class AIIntegrationController {
  constructor(private aiService: AIIntegrationService) {}

  setup(app: Elysia) {
    return app
      .use(
        jwt({
          name: "jwt",
          secret: process.env.JWT_SECRET || "your-secret-key",
        })
      )
      .group("/ai", (app) =>
        app
          .post(
            "/initialize",
            async ({ body, jwt, set }) => {
              try {
                // Verify system key
                const isValid = await jwt.verify(body.systemKey);
                if (!isValid) {
                  set.status = 401;
                  return { success: false, error: "Invalid system key" };
                }

                // Initialize the AI system
                const result = await this.aiService.initializeSystem(
                  body.config
                );

                // Generate access token for future communications
                const accessToken = await jwt.sign({
                  systemId: result.systemId,
                  timestamp: Date.now(),
                });

                return {
                  success: true,
                  systemId: result.systemId,
                  activeAgents: result.activeAgents,
                  networkStatus: result.networkStatus,
                  accessToken,
                };
              } catch (error) {
                set.status = 500;
                return {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to initialize system",
                };
              }
            },
            {
              body: InitializeRequestSchema,
              detail: {
                tags: ["AI Integration"],
                summary: "Initialize the AI city system",
                description:
                  "Start the AI city system and enable communication between AI agents",
              },
            }
          )
          .get(
            "/status",
            async ({ jwt, headers, set }) => {
              try {
                const auth = headers.authorization;
                if (!auth?.startsWith("Bearer ")) {
                  set.status = 401;
                  return {
                    success: false,
                    error: "Missing authorization token",
                  };
                }

                const token = auth.slice(7);
                const isValid = await jwt.verify(token);
                if (!isValid) {
                  set.status = 401;
                  return { success: false, error: "Invalid token" };
                }

                // Return system status
                return {
                  success: true,
                  status: "operational",
                  timestamp: Date.now(),
                };
              } catch (error) {
                set.status = 500;
                return {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to get system status",
                };
              }
            },
            {
              detail: {
                tags: ["AI Integration"],
                summary: "Get AI city system status",
                description: "Check the current status of the AI city system",
              },
            }
          )
      );
  }
}
