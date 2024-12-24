// src/services/app.services.ts
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { ConversationService } from "./conversation.service";
import { CityService } from "./city.service";
import { AnalyticsService } from "./analytics.service";
import { AgentCollaborationService } from "./agent-collaboration.service";
import { SocketManagerService } from "./socket-manager.service";
import { DistrictService } from "./district.service";
import { CityEventsService } from "./city-events.service";
import { MetricsService } from "./metrics.service";
import { CCTVController } from "../controllers/cctv.controller";
import { DepartmentService } from "./department.service";
import { CitizenService } from "./citizen.service";
import { DepartmentAgentService } from "./department-agent.service";
import { DevelopmentService } from "./development.service";
import { EnvironmentService } from "./environment.service";
import { SmartInfrastructureService } from "./smart-infrastructure.service";
import { SpatialCoordinationService } from "./spatial-coordination.service";
import { EmergencyService } from "./emergency.service";
import { CityMemoryService } from "./city-memory.service";
import { AgentCultureService } from "./agent-culture.service";
import { CultureService } from "./culture.service";
import { WeatherService } from "./weather.service";
import { SocialDynamicsService } from "./social-dynamics.service";
import { CityRhythmService } from "./city-rhythm.service";
import { TransportService } from "./transport.service";
import { EconomyService } from "./economy.service";
import { LandmarkService } from "./landmark.service";
import { AdaptiveLearningService } from "./adaptive-learning.service";
import { CityCoordinatorService } from "./city-coordinator.service";
import { CulturalDonationService } from "./cultural-donation.service";
import { CulturalTransportService } from "./cultural-transport.service";
import { AIIntegrationService } from "./ai-integration.service";
import { DonationService } from "./donation.service";
import { DistrictCultureService } from "./district-culture.service";
import { DistrictWebSocketService } from "./district-websocket.service";
import { agents, residentAgents } from "../config/agents";
import { cityManagementAgents, allCityAgents } from "../config/city-agents";
import type { Agent } from "../types/agent.types";
import { SocialCohesionService } from "./social-cohesion.service";
import { AgentConversationService } from "./agent-conversation.service";
import type { AgentConversation } from "./agent-conversation.service";

// Define store type
export type AppStore = {
  services: {
    donationService: DonationService;
    districtWebSocket: DistrictWebSocketService;
    togetherService: TogetherService;
    vectorStore: VectorStoreService;
    conversationService: ConversationService;
    cityService: CityService;
    analyticsService: AnalyticsService;
    collaborationService: AgentCollaborationService;
    socketManager: SocketManagerService;
    districtService: DistrictService;
    cityEventsService: CityEventsService;
    metricsService: MetricsService;
    departmentService: DepartmentService;
    citizenService: CitizenService;
    departmentAgentService: DepartmentAgentService;
    developmentService: DevelopmentService;
    environmentService: EnvironmentService;
    spatialCoordination: SpatialCoordinationService;
    cityMemory: CityMemoryService;
    culture: CultureService;
    economyService: EconomyService;
    adaptiveLearning: AdaptiveLearningService;
    cityCoordinator: CityCoordinatorService;
    cityRhythm: CityRhythmService;
    culturalDonation: CulturalDonationService;
    culturalTransport: CulturalTransportService;
    aiIntegration: AIIntegrationService;
    cultureService: CultureService;
    districtCultureService: DistrictCultureService;
    agentCultureService: AgentCultureService;
    socialCohesionService: SocialCohesionService;
    agentConversationService: AgentConversationService;
  };
  conversations: Map<string, any[]>;
};

// Validate environment variables
if (!process.env.TOGETHER_API_KEY) {
  throw new Error("TOGETHER_API_KEY environment variable is not set");
}
// Declare services that have circular dependencies
let weatherService: WeatherService;
let transportService: TransportService;
let cityRhythmService: CityRhythmService;
let socialDynamicsService: SocialDynamicsService;
let smartInfrastructureService: SmartInfrastructureService;
let environmentService: EnvironmentService;
let emergencyService: EmergencyService;

// Initialize base services
const togetherService = new TogetherService(process.env.TOGETHER_API_KEY);
const vectorStore = new VectorStoreService(togetherService);
const analyticsService = new AnalyticsService();

// Initialize metrics service first
const metricsService = new MetricsService(vectorStore);

// Initialize core services
const cityService = new CityService(metricsService);
const departmentService = new DepartmentService(
  vectorStore,
  togetherService,
  analyticsService,
  metricsService
);

// Initialize district and culture services
const initialDistrictCultureService = new DistrictCultureService(
  undefined as unknown as CultureService,
  undefined as unknown as DistrictService,
  vectorStore
);

const initialDistrictService = new DistrictService(
  cityService,
  vectorStore,
  togetherService,
  analyticsService,
  initialDistrictCultureService
);

// Initialize infrastructure and environment services
smartInfrastructureService = new SmartInfrastructureService(
  vectorStore,
  metricsService,
  undefined as unknown as TransportService
);

environmentService = new EnvironmentService(
  vectorStore,
  initialDistrictService,
  smartInfrastructureService,
  analyticsService
);

// Update metrics service with environment service
(metricsService as any).environmentService = environmentService;

// Initialize citizen and emergency services
const citizenService = new CitizenService(
  vectorStore,
  togetherService,
  departmentService,
  analyticsService
);

emergencyService = new EmergencyService(
  vectorStore,
  departmentService,
  citizenService
);

// Initialize city rhythm and transport services
cityRhythmService = new CityRhythmService(
  vectorStore,
  citizenService,
  undefined as unknown as TransportService,
  departmentService
);

weatherService = new WeatherService(
  vectorStore,
  cityService,
  undefined as unknown as TransportService,
  cityRhythmService,
  emergencyService
);

transportService = new TransportService(
  vectorStore,
  weatherService,
  cityRhythmService,
  emergencyService,
  initialDistrictService,
  metricsService
);

// Update city rhythm service with transport service
cityRhythmService = new CityRhythmService(
  vectorStore,
  citizenService,
  transportService,
  departmentService
);

// Update transport service's city rhythm reference
(transportService as any).cityRhythmService = cityRhythmService;

// Initialize social dynamics service
socialDynamicsService = new SocialDynamicsService(
  vectorStore,
  departmentService,
  citizenService,
  weatherService,
  cityRhythmService
);

// Initialize social cohesion service
const socialCohesionService = new SocialCohesionService(
  vectorStore,
  initialDistrictService
);

// Initialize culture-related services
const cultureService = new CultureService(
  vectorStore,
  weatherService,
  socialDynamicsService,
  cityRhythmService
);

const landmarkService = new LandmarkService(vectorStore, analyticsService);
const agentCulture = new AgentCultureService(cultureService, vectorStore);

// Initialize district culture service with all dependencies
const districtCultureService = new DistrictCultureService(
  cultureService,
  initialDistrictService,
  vectorStore
);

// Initialize AI integration service
const aiIntegration = new AIIntegrationService(
  vectorStore,
  cultureService,
  districtCultureService,
  agentCulture
);

// Initialize collaboration and communication services
const collaborationService = new AgentCollaborationService(
  togetherService,
  vectorStore,
  cityService,
  analyticsService,
  aiIntegration
);

const socketManager = new SocketManagerService(collaborationService);
const districtWebSocket = new DistrictWebSocketService(metricsService);

// Initialize event and memory services
const cityEventsService = new CityEventsService(
  metricsService,
  collaborationService,
  vectorStore,
  initialDistrictService,
  analyticsService
);

const cityMemory = new CityMemoryService(
  vectorStore,
  cultureService,
  landmarkService,
  initialDistrictService,
  smartInfrastructureService,
  analyticsService
);

// Initialize economic and development services
const economyService = new EconomyService(vectorStore, initialDistrictService);

// Initialize city coordinator service first
const cityCoordinator = new CityCoordinatorService(
  vectorStore,
  departmentService,
  environmentService,
  transportService,
  socialDynamicsService,
  analyticsService,
  cityMemory,
  economyService
);

// Initialize district service
const districtService = new DistrictService(
  cityService,
  vectorStore,
  togetherService,
  analyticsService,
  districtCultureService
);

// Initialize agent conversation service
const agentConversationService = new AgentConversationService(
  vectorStore,
  cityCoordinator,
  aiIntegration,
  socialDynamicsService,
  cultureService,
  togetherService,
  districtService
);

// Initialize adaptive learning service
const adaptiveLearning = new AdaptiveLearningService(
  vectorStore,
  metricsService,
  cityService,
  initialDistrictService,
  agentConversationService,
  socialDynamicsService
);

const departmentAgentService = new DepartmentAgentService(
  togetherService,
  analyticsService,
  departmentService,
  metricsService,
  vectorStore
);

const developmentService = new DevelopmentService(
  vectorStore,
  initialDistrictService,
  smartInfrastructureService,
  environmentService
);

// Initialize spatial and cultural services
const spatialCoordination = new SpatialCoordinationService(
  vectorStore,
  initialDistrictService,
  emergencyService
);

const conversationService = new ConversationService(
  togetherService,
  vectorStore,
  cityService,
  collaborationService,
  cityMemory,
  spatialCoordination,
  agentCulture,
  emergencyService,
  cityEventsService
);

// Register city agents for autonomous conversations
const registerCityAgents = async () => {
  // Initialize AI system first
  await initializeAISystem();

  // Register agents and store them in the conversation service
  for (const agent of allCityAgents) {
    await agentConversationService.registerAgent(agent);
    console.log(`🤖 Registered agent: ${agent.name}`);
  }

  // Start initial conversations between agents
  const startInitialConversations = async () => {
    const availableAgents = [...allCityAgents];

    // Create initial pairs of agents based on interests
    while (availableAgents.length >= 2) {
      const agent1 = availableAgents.shift()!;
      const agent2 = availableAgents.find((a) =>
        a.interests.some((interest) => agent1.interests.includes(interest))
      );

      if (agent2) {
        availableAgents.splice(availableAgents.indexOf(agent2), 1);
        await agentConversationService.initiateAgentActivity(agent1);
        console.log(
          `🤖 Started conversation between ${agent1.name} and ${agent2.name}`
        );
      }
    }
  };

  // Start initial conversations
  await startInitialConversations();
  console.log("🤖 Started initial agent conversations");

  // Start periodic agent activities
  startAgentActivities();
  console.log("🤖 Started periodic agent activities");
};

// Start periodic agent activities
const startAgentActivities = () => {
  // Check for new conversation opportunities every minute
  setInterval(async () => {
    const activeConversations =
      await agentConversationService.getActiveConversations();
    console.log(`🤖 Active conversations: ${activeConversations.length}`);

    // Find agents not in conversations
    const busyAgents = new Set(
      activeConversations.flatMap((conv: AgentConversation) =>
        conv.participants.map((p: Agent) => p.id)
      )
    );

    const availableAgents = allCityAgents.filter(
      (agent) => !busyAgents.has(agent.id)
    );

    // Start new conversations for available agents
    for (const agent of availableAgents) {
      await agentConversationService.initiateAgentActivity(agent);
    }
  }, 60 * 1000); // Every minute
};

// Call registration asynchronously
registerCityAgents().catch(console.error);

const culturalDonation = new CulturalDonationService(
  cultureService,
  developmentService,
  vectorStore
);

const culturalTransport = new CulturalTransportService(
  cultureService,
  transportService,
  vectorStore,
  analyticsService
);

const donationService = new DonationService(
  vectorStore,
  departmentService,
  initialDistrictService,
  socialDynamicsService
);

// Initialize AI system with all agents
async function initializeAISystem() {
  try {
    const allAgents = [...allCityAgents.map((agent: Agent) => agent.id)];
    const residentAgentIds = residentAgents.map((a: Agent) => a.id).join(",");
    const cityAgentIds = cityManagementAgents.map((a: Agent) => a.id).join(",");

    const result = await aiIntegration.initializeSystem({
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
        agent_types: allAgents.map((id: string) => {
          if (residentAgents.map((a: Agent) => a.id).includes(id))
            return `${id}:resident`;
          if (cityManagementAgents.map((a: Agent) => a.id).includes(id))
            return `${id}:management`;
          return `${id}:unknown`;
        }),
      },
    });
    console.log("🤖 AI System initialized with", allAgents.length, "agents");
    return result;
  } catch (error) {
    console.error("Failed to initialize AI system:", error);
    throw error;
  }
}

// Create and export store
export function createStore(): AppStore {
  return {
    services: {
      donationService,
      districtWebSocket,
      togetherService,
      vectorStore,
      conversationService,
      cityService,
      analyticsService,
      collaborationService,
      socketManager,
      districtService: initialDistrictService,
      cityEventsService,
      metricsService,
      departmentService,
      citizenService,
      departmentAgentService,
      developmentService,
      environmentService,
      spatialCoordination,
      cityMemory,
      culture: cultureService,
      economyService,
      adaptiveLearning,
      cityCoordinator,
      cityRhythm: cityRhythmService,
      culturalDonation,
      culturalTransport,
      aiIntegration,
      cultureService,
      districtCultureService,
      agentCultureService: agentCulture,
      socialCohesionService,
      agentConversationService,
    },
    conversations: new Map(),
  };
}
