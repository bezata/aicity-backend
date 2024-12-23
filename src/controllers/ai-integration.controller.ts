import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { AIIntegrationService } from "../services/ai-integration.service";
import {
  allCityAgents,
  cityManagementAgents,
  residentAgents,
  infrastructureAgents,
  transportationAgents,
  environmentalAgents,
  culturalAgents,
  donationAgents,
} from "../config/city-agents";
import { CultureService } from "../services/culture.service";
import { DistrictCultureService } from "../services/district-culture.service";
import { AgentCultureService } from "../services/agent-culture.service";
import { Agent } from "../types/agent.types";

// Define request schemas
const InitializeRequestSchema = t.Object({
  systemKey: t.String(),
  config: t.Optional(
    t.Object({
      agents: t.Array(t.String()),
      protocol: t.Object({
        name: t.String(),
        version: t.String(),
        rules: t.Array(t.String()),
      }),
      initialState: t.Optional(t.Record(t.String(), t.Any())),
    })
  ),
});

export class AIIntegrationController {
  constructor(
    private aiService: AIIntegrationService,
    private cultureService: CultureService,
    private districtCultureService: DistrictCultureService,
    private agentCultureService: AgentCultureService
  ) {}

  private async initializeDefaultSystem() {
    const allAgents = [...allCityAgents.map((agent) => agent.id)];

    // Create Pinecone-compatible metadata
    const residentAgentIds = residentAgents.map((a) => a.id).join(",");
    const cityAgentIds = cityManagementAgents.map((a) => a.id).join(",");

    return await this.aiService.initializeSystem({
      agents: allAgents,
      protocol: {
        name: "city-management",
        version: "1.0.0",
        rules: [
          "The city is a living organism that evolves and adapts to the needs of its residents.",
          "The city is a collaborative entity that works together to achieve its goals.",
          "The city is a sustainable entity that works together to achieve its goals.",
          "The city is a resilient entity that works together to achieve its goals.",
        ],
      },
      initialState: {
        resident_agents: residentAgentIds,
        city_agents: cityAgentIds,
        agent_count: allAgents.length,
        initialized: true,
        agent_types: allAgents.map((id) => {
          if (residentAgents.map((a) => a.id).includes(id))
            return `${id}:resident`;
          if (cityManagementAgents.map((a) => a.id).includes(id))
            return `${id}:management`;
          return `${id}:unknown`;
        }),
      },
    });
  }

  private async initializeReadySystem() {
    try {
      // Initialize agent cultural profiles first
      await Promise.all(
        allCityAgents.map(async (agent: Agent) => {
          await this.agentCultureService.initializeAgentCulture(agent);
        })
      );

      const allAgentIds = allCityAgents.map((agent: Agent) => agent.id);

      // Get cultural compatibility data
      const culturalCompatibility = await Promise.all(
        allCityAgents.map(async (agent: Agent) => {
          const compatibility =
            await this.agentCultureService.getAgentCulturalCompatibility(agent);
          return {
            agentId: agent.id,
            ...compatibility,
          };
        })
      );

      // Create Pinecone-compatible metadata
      const residentAgentIds = residentAgents
        .map((agent: Agent) => agent.id)
        .join(",");
      const cityAgentIds = cityManagementAgents
        .map((agent: Agent) => agent.id)
        .join(",");

      // Create category-specific metadata
      const infrastructureAgentIds = infrastructureAgents
        .map((agent: Agent) => agent.id)
        .join(",");
      const transportationAgentIds = transportationAgents
        .map((agent: Agent) => agent.id)
        .join(",");
      const environmentalAgentIds = environmentalAgents
        .map((agent: Agent) => agent.id)
        .join(",");
      const culturalAgentIds = culturalAgents
        .map((agent: Agent) => agent.id)
        .join(",");
      const donationAgentIds = donationAgents
        .map((agent: Agent) => agent.id)
        .join(",");

      const result = await this.aiService.initializeSystem({
        agents: allAgentIds,
        protocol: {
          name: "city-management",
          version: "1.0.0",
          rules: [
            "The city is a living organism that evolves and adapts to the needs of its residents.",
            "The city is a collaborative entity that works together to achieve its goals.",
            "The city is a sustainable entity that works together to achieve its goals.",
            "The city is a resilient entity that works together to achieve its goals.",
            "Each agent category has specific responsibilities and expertise areas.",
            "Agents should collaborate across categories to solve complex problems.",
            "Cultural and religious diversity must be respected and preserved.",
            "Environmental sustainability is a core principle in all decisions.",
          ],
        },
        initialState: {
          resident_agents: residentAgentIds,
          city_agents: cityAgentIds,
          infrastructure_agents: infrastructureAgentIds,
          transportation_agents: transportationAgentIds,
          environmental_agents: environmentalAgentIds,
          cultural_agents: culturalAgentIds,
          donation_agents: donationAgentIds,
          agent_count: allAgentIds.length,
          initialized: true,
          agent_types: allAgentIds.map((id: string) => {
            if (residentAgents.some((agent: Agent) => agent.id === id))
              return `${id}:resident`;
            if (infrastructureAgents.some((agent: Agent) => agent.id === id))
              return `${id}:infrastructure`;
            if (transportationAgents.some((agent: Agent) => agent.id === id))
              return `${id}:transportation`;
            if (environmentalAgents.some((agent: Agent) => agent.id === id))
              return `${id}:environmental`;
            if (culturalAgents.some((agent: Agent) => agent.id === id))
              return `${id}:cultural`;
            if (donationAgents.some((agent: Agent) => agent.id === id))
              return `${id}:donation`;
            return `${id}:unknown`;
          }),
          agent_categories: {
            infrastructure: {
              count: infrastructureAgents.length,
              focus_areas: [
                "urban planning",
                "smart infrastructure",
                "development",
              ],
            },
            transportation: {
              count: transportationAgents.length,
              focus_areas: ["mobility", "traffic management", "public transit"],
            },
            environmental: {
              count: environmentalAgents.length,
              focus_areas: ["sustainability", "climate", "green initiatives"],
            },
            cultural: {
              count: culturalAgents.length,
              focus_areas: ["religious affairs", "traditions", "community"],
            },
            donation: {
              count: donationAgents.length,
              focus_areas: ["fundraising", "project management", "development"],
            },
          },
          cultural_compatibility: culturalCompatibility,
        },
      });

      // Initialize cultural interactions
      await this.agentCultureService.initializeCulturalInteractions(
        allCityAgents
      );

      console.log("🤖 AI System initialized with", {
        total_agents: allAgentIds.length,
        residents: residentAgents.length,
        infrastructure: infrastructureAgents.length,
        transportation: transportationAgents.length,
        environmental: environmentalAgents.length,
        cultural: culturalAgents.length,
        donation: donationAgents.length,
        cultural_profiles: culturalCompatibility.length,
      });

      return result;
    } catch (error) {
      console.error("Failed to initialize AI system:", error);
      throw error;
    }
  }

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

                // Initialize the AI system with either custom config or default
                const result = await (body.config
                  ? this.aiService.initializeSystem(body.config)
                  : this.initializeDefaultSystem());

                // Generate access token for future communications
                const accessToken = await jwt.sign({
                  systemId: result.systemId,
                  timestamp: Date.now(),
                });

                console.log("🤖 AI System initialized successfully");
                return {
                  success: true,
                  systemId: result.systemId,
                  activeAgents: result.activeAgents,
                  networkStatus: result.networkStatus,
                  accessToken,
                };
              } catch (error) {
                console.error("Failed to initialize AI system:", error);
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
                  "Start the AI city system and enable communication between AI agents. Can provide custom configuration or use default settings.",
              },
            }
          )
          .post(
            "/initialize-ready",
            async ({ jwt, set }) => {
              try {
                const result = await this.initializeReadySystem();

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
                console.error("Failed to initialize AI system:", error);
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
              detail: {
                tags: ["AI Integration"],
                summary:
                  "Initialize the AI city system with ready configuration",
                description:
                  "Start the AI city system with a predefined configuration that includes all city agents and default settings.",
              },
            }
          )
          .post(
            "/initialize-culture",
            async ({ set }) => {
              try {
                // Initialize all cultural services
                await this.cultureService.initialize();
                await this.districtCultureService.initialize();

                return {
                  success: true,
                  message: "Cultural services initialized successfully",
                  timestamp: Date.now(),
                };
              } catch (error) {
                console.error("Failed to initialize cultural services:", error);
                set.status = 500;
                return {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to initialize cultural services",
                };
              }
            },
            {
              detail: {
                tags: ["AI Integration"],
                summary: "Initialize cultural services",
                description:
                  "Initialize all cultural-related services including culture service, district culture service, and agent culture service.",
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
