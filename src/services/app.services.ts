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

// Define store type
export type AppStore = {
  services: {
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

// Initialize base services
const togetherService = new TogetherService(process.env.TOGETHER_API_KEY);
const vectorStore = new VectorStoreService(togetherService);
const metricsService = new MetricsService(vectorStore);
const cityService = new CityService();
const departmentService = new DepartmentService(vectorStore, togetherService);
const citizenService = new CitizenService(
  vectorStore,
  togetherService,
  departmentService
);
const emergencyService = new EmergencyService(
  vectorStore,
  departmentService,
  citizenService
);

// Create initial instances with undefined instead of null
const initialCityRhythm = new CityRhythmService(
  vectorStore,
  citizenService,
  undefined as unknown as TransportService,
  departmentService
);
const initialEmergency = new EmergencyService(
  vectorStore,
  departmentService,
  citizenService
);
const initialWeather = new WeatherService(
  vectorStore,
  cityService,
  undefined as unknown as TransportService,
  initialCityRhythm,
  initialEmergency
);
const initialTransport = new TransportService(
  vectorStore,
  initialWeather,
  initialCityRhythm,
  emergencyService
);

// Now create the final instances with proper dependencies
weatherService = new WeatherService(
  vectorStore,
  cityService,
  initialTransport,
  initialCityRhythm,
  initialEmergency
);
transportService = new TransportService(
  vectorStore,
  weatherService,
  initialCityRhythm,
  emergencyService
);
cityRhythmService = new CityRhythmService(
  vectorStore,
  citizenService,
  transportService,
  departmentService
);

// Update the references
socialDynamicsService = new SocialDynamicsService(
  vectorStore,
  departmentService,
  citizenService,
  initialWeather,
  cityRhythmService
);

// Initialize culture service with correct dependencies
const cultureService = new CultureService(
  vectorStore,
  weatherService,
  socialDynamicsService,
  cityRhythmService
);
const landmarkService = new LandmarkService();
// Initialize remaining services
const agentCulture = new AgentCultureService(cultureService, vectorStore);
const cityMemory = new CityMemoryService(
  vectorStore,
  cultureService,
  landmarkService
);
const analyticsService = new AnalyticsService();
const districtService = new DistrictService(
  cityService,
  vectorStore,
  togetherService
);
const collaborationService = new AgentCollaborationService(
  togetherService,
  vectorStore,
  cityService
);
const socketManager = new SocketManagerService(collaborationService);
const cityEventsService = new CityEventsService(
  metricsService,
  collaborationService,
  vectorStore,
  districtService
);
const smartInfrastructureService = new SmartInfrastructureService();
const environmentService = new EnvironmentService(
  vectorStore,
  districtService,
  smartInfrastructureService
);

const departmentAgentService = new DepartmentAgentService(togetherService);
const developmentService = new DevelopmentService(
  vectorStore,
  districtService,
  smartInfrastructureService,
  environmentService
);
const spatialCoordination = new SpatialCoordinationService(
  vectorStore,
  districtService,
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

// Initialize economy service
const economyService = new EconomyService(vectorStore, districtService);

// Create initial store
export const createStore = (): AppStore => ({
  services: {
    togetherService,
    vectorStore,
    conversationService,
    cityService,
    analyticsService,
    collaborationService,
    socketManager,
    districtService,
    cityEventsService,
    metricsService,
    departmentService,
    citizenService,
    departmentAgentService,
    developmentService,
    environmentService,
    spatialCoordination,
    cityMemory: new CityMemoryService(
      vectorStore,
      cultureService,
      landmarkService
    ),
    culture: cultureService,
    economyService,
  },
  conversations: new Map(),
});
