import { EventEmitter } from "events";
import { Message, ConversationState } from "../types/conversation.types";

interface EventMetadata {
  priority: "low" | "medium" | "high" | "critical";
  timestamp: number;
  source: string;
  acknowledged: boolean;
  acknowledgments?: { agentId: string; timestamp: number }[];
  persistent?: boolean;
  category:
    | "conversation"
    | "emergency"
    | "infrastructure"
    | "ai"
    | "cultural"
    | "environmental";
  ttl?: number; // Time to live in milliseconds
}

interface EventFilter {
  priority?: EventMetadata["priority"][];
  category?: EventMetadata["category"][];
  source?: string[];
  timeRange?: { start: number; end: number };
  acknowledged?: boolean;
}

interface PersistentEvent {
  id: string;
  type: string;
  data: any;
  metadata: EventMetadata;
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventHistory: Map<string, PersistentEvent> = new Map();
  private eventFilters: Map<string, EventFilter> = new Map();
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 1000 * 60 * 5; // 5 minutes

  private constructor() {
    super();
    this.initializeEventCleanup();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  private initializeEventCleanup() {
    setInterval(() => {
      this.cleanupExpiredEvents();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupExpiredEvents() {
    const now = Date.now();
    for (const [id, event] of this.eventHistory) {
      if (
        event.metadata.ttl &&
        now - event.metadata.timestamp > event.metadata.ttl
      ) {
        this.eventHistory.delete(id);
      }
    }

    // Keep history size in check
    if (this.eventHistory.size > this.MAX_HISTORY_SIZE) {
      const sortedEvents = Array.from(this.eventHistory.entries()).sort(
        ([, a], [, b]) => a.metadata.timestamp - b.metadata.timestamp
      );

      const eventsToRemove = sortedEvents.slice(
        0,
        this.eventHistory.size - this.MAX_HISTORY_SIZE
      );
      eventsToRemove.forEach(([id]) => this.eventHistory.delete(id));
    }
  }

  private createEventMetadata(
    priority: EventMetadata["priority"],
    category: EventMetadata["category"],
    source: string,
    persistent: boolean = false,
    ttl?: number
  ): EventMetadata {
    return {
      priority,
      timestamp: Date.now(),
      source,
      acknowledged: false,
      acknowledgments: [],
      persistent,
      category,
      ttl,
    };
  }

  // Enhanced event emission with metadata
  private emitWithMetadata(type: string, data: any, metadata: EventMetadata) {
    const eventId = crypto.randomUUID();
    const event: PersistentEvent = { id: eventId, type, data, metadata };

    // Store if persistent
    if (metadata.persistent) {
      this.eventHistory.set(eventId, event);
    }

    // Apply filters before emitting
    if (this.shouldEmitEvent(event)) {
      this.emit(type, { ...data, _eventId: eventId });

      // Auto-acknowledge low priority events
      if (metadata.priority === "low") {
        this.acknowledgeEvent(eventId, "system");
      }
    }

    return eventId;
  }

  private shouldEmitEvent(event: PersistentEvent): boolean {
    for (const filter of this.eventFilters.values()) {
      if (
        (filter.priority &&
          !filter.priority.includes(event.metadata.priority)) ||
        (filter.category &&
          !filter.category.includes(event.metadata.category)) ||
        (filter.source && !filter.source.includes(event.metadata.source)) ||
        (filter.timeRange &&
          (event.metadata.timestamp < filter.timeRange.start ||
            event.metadata.timestamp > filter.timeRange.end)) ||
        (filter.acknowledged !== undefined &&
          filter.acknowledged !== event.metadata.acknowledged)
      ) {
        return false;
      }
    }
    return true;
  }

  // Event acknowledgment
  acknowledgeEvent(eventId: string, agentId: string): boolean {
    const event = this.eventHistory.get(eventId);
    if (!event) return false;

    event.metadata.acknowledged = true;
    event.metadata.acknowledgments?.push({
      agentId,
      timestamp: Date.now(),
    });

    this.eventHistory.set(eventId, event);
    this.emit("eventAcknowledged", { eventId, agentId });
    return true;
  }

  // Filter management
  addEventFilter(filterId: string, filter: EventFilter) {
    this.eventFilters.set(filterId, filter);
  }

  removeEventFilter(filterId: string) {
    this.eventFilters.delete(filterId);
  }

  // Event history management
  getEventHistory(filter?: EventFilter): PersistentEvent[] {
    let events = Array.from(this.eventHistory.values());

    if (filter) {
      events = events.filter((event) => {
        return this.shouldEmitEvent(event);
      });
    }

    return events;
  }

  // Enhanced event emitters for different scenarios
  emitMessageCreated(conversationId: string, message: Message) {
    return this.emitWithMetadata(
      "messageCreated",
      { conversationId, message },
      this.createEventMetadata(
        "low",
        "conversation",
        "chat",
        true,
        1000 * 60 * 60
      ) // 1 hour TTL
    );
  }

  emitStateUpdated(conversationId: string, state: ConversationState) {
    return this.emitWithMetadata(
      "stateUpdated",
      { conversationId, state },
      this.createEventMetadata("low", "conversation", "system", true)
    );
  }

  emitAgentTyping(conversationId: string, agentId: string) {
    return this.emitWithMetadata(
      "agentTyping",
      { conversationId, agentId },
      this.createEventMetadata("low", "conversation", agentId, false, 1000 * 10) // 10 second TTL
    );
  }

  emitError(error: Error) {
    return this.emitWithMetadata(
      "error",
      { error },
      this.createEventMetadata("high", "infrastructure", "system", true)
    );
  }

  // New AI city-specific event emitters
  emitEmergencyAlert(emergencyData: any) {
    return this.emitWithMetadata(
      "emergencyAlert",
      emergencyData,
      this.createEventMetadata(
        "critical",
        "emergency",
        "emergency-system",
        true
      )
    );
  }

  emitInfrastructureUpdate(updateData: any) {
    return this.emitWithMetadata(
      "infrastructureUpdate",
      updateData,
      this.createEventMetadata(
        "medium",
        "infrastructure",
        "infrastructure-system",
        true
      )
    );
  }

  emitAIAgentAction(actionData: any) {
    return this.emitWithMetadata(
      "aiAgentAction",
      actionData,
      this.createEventMetadata("medium", "ai", actionData.agentId, true)
    );
  }

  emitCulturalEvent(eventData: any) {
    return this.emitWithMetadata(
      "culturalEvent",
      eventData,
      this.createEventMetadata("medium", "cultural", "cultural-system", true)
    );
  }

  emitEnvironmentalAlert(alertData: any) {
    return this.emitWithMetadata(
      "environmentalAlert",
      alertData,
      this.createEventMetadata(
        alertData.severity === "critical" ? "critical" : "high",
        "environmental",
        "environmental-system",
        true
      )
    );
  }
}
