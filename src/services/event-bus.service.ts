import { EventEmitter } from "events";
import { Message, ConversationState } from "../types/conversation.types";

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitMessageCreated(conversationId: string, message: Message) {
    this.emit("messageCreated", { conversationId, message });
  }

  emitStateUpdated(conversationId: string, state: ConversationState) {
    this.emit("stateUpdated", { conversationId, state });
  }

  emitAgentTyping(conversationId: string, agentId: string) {
    this.emit("agentTyping", { conversationId, agentId });
  }

  emitError(error: Error) {
    this.emit("error", error);
  }
}
