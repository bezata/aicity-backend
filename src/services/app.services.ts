// src/services/app.services.ts
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { ConversationService } from "./conversation.service";
import { CityService } from "./city.service";
import { AnalyticsService } from "./analytics.service";
import { AgentCollaborationService } from "./agent-collaboration.service";
import { SocketManagerService } from "./socket-manager.service";

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
const conversationService = new ConversationService(
  togetherService,
  vectorStore
);
const cityService = new CityService();
const analyticsService = new AnalyticsService();
const collaborationService = new AgentCollaborationService(
  togetherService,
  vectorStore
);
const socketManager = new SocketManagerService(collaborationService);

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
  },
  conversations: new Map(),
});
