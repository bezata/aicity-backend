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
  };
  conversations: Map<string, any[]>;
};

// Validate environment variables
if (!process.env.TOGETHER_API_KEY) {
  throw new Error("TOGETHER_API_KEY environment variable is not set");
}

// Initialize services
const togetherService = new TogetherService(process.env.TOGETHER_API_KEY);
const vectorStore = new VectorStoreService(togetherService);
const metricsService = new MetricsService(vectorStore);
const conversationService = new ConversationService(
  togetherService,
  vectorStore
);
const cityService = new CityService();
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
const departmentService = new DepartmentService(vectorStore, togetherService);
const citizenService = new CitizenService(
  vectorStore,
  togetherService,
  departmentService
);
const environmentService = new EnvironmentService();
const smartInfrastructureService = new SmartInfrastructureService();
const departmentAgentService = new DepartmentAgentService(togetherService);
const developmentService = new DevelopmentService(
  vectorStore,
  districtService,
  smartInfrastructureService,
  environmentService
);

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
  },
  conversations: new Map(),
});
