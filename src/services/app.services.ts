// src/services/app.services.ts
import { TogetherService } from "./together.service";
import { VectorStoreService } from "./vector-store.service";
import { ConversationService } from "./conversation.service";

const togetherService = new TogetherService(process.env.TOGETHER_API_KEY!);
const vectorStore = new VectorStoreService(process.env.PINECONE_API_KEY!);
const conversationService = new ConversationService(
  togetherService,
  vectorStore
);

export const services = {
  togetherService,
  vectorStore,
  conversationService,
};
