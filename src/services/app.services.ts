// src/services/app.services.ts
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { ConversationService } from "./conversation.service";
import { CityService } from "./city.service";
import { AnalyticsService } from "./analytics.service";

// Define store type
export type AppStore = {
  services: {
    togetherService: TogetherService;
    vectorStore: VectorStoreService;
    conversationService: ConversationService;
    cityService: CityService;
    analyticsService: AnalyticsService;
  };
  conversations: Map<string, any[]>;
};

// Validate environment variables
if (!process.env.TOGETHER_API_KEY) {
  throw new Error("TOGETHER_API_KEY environment variable is not set");
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

// Initialize services
const togetherService = new TogetherService(process.env.TOGETHER_API_KEY);
const vectorStore = new VectorStoreService(process.env.MONGODB_URI);
const conversationService = new ConversationService(
  togetherService,
  vectorStore
);
const cityService = new CityService();
const analyticsService = new AnalyticsService();

// Create initial store
export const createStore = (): AppStore => ({
  services: {
    togetherService,
    vectorStore,
    conversationService,
    cityService,
    analyticsService,
  },
  conversations: new Map(),
});
