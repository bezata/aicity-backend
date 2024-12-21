import type { ConversationState, Message } from "../types/conversation.types";
import { CityContextManager } from "./city-context";

export class ConversationDynamics {
  private states = new Map<string, ConversationState>();
  private readonly DECAY_RATE = 0.1;
  private readonly MIN_MOMENTUM = 0.1;
  private readonly MAX_MOMENTUM = 0.9;
  private cityContext: CityContextManager;

  constructor(cityContext: CityContextManager) {
    this.cityContext = cityContext;
    // Subscribe to city updates
    this.cityContext.onUpdate(this.handleCityUpdate.bind(this));
  }

  private handleCityUpdate(update: any): void {
    // Update all active conversations based on city changes
    this.states.forEach((state, conversationId) => {
      if (state.status === "active") {
        if (update.type === "metric") {
          // Adjust conversation style based on efficiency
          if (update.data.metric === "efficiency") {
            state.currentStyle = update.data.value > 0.7 ? "formal" : "casual";
          }
          // Adjust emotional state based on livability
          if (update.data.metric === "livability") {
            state.emotionalState = update.data.value;
          }
        } else if (update.type === "event") {
          // Add event-related topics
          state.topics.push(update.data.description);
          state.currentTopics.add(update.data.description);
        }
      }
    });
  }

  updateState(conversationId: string, message: Message): void {
    let state = this.getState(conversationId);
    const context = this.cityContext.getContext();

    // Update time-based metrics
    const now = Date.now();
    const timeSinceLastMessage = now - state.lastInteractionTime;
    state.silenceDuration = timeSinceLastMessage;
    state.lastInteractionTime = now;
    state.lastMessageTimestamp = now;

    // Update momentum with city context influence
    state.momentum = this.calculateNewMomentum(
      state,
      message,
      timeSinceLastMessage,
      context
    );

    // Update topics with city events
    if (message.topics) {
      const cityEvents = context.state.activeEvents.map((e) => e.description);
      state.topics = [...new Set([...message.topics, ...cityEvents])];
      state.currentTopics = new Set(state.topics);
    }

    // Update sentiment based on city mood
    state.sentiment = (state.sentiment + context.metrics.livability) / 2;

    // Update interaction metrics
    state.interactionCount++;
    state.messageCount++;
    state.silenceProbability = this.calculateSilenceProbability(state, context);
    state.timeOfDay = this.getTimeOfDay();

    this.states.set(conversationId, state);
  }

  private calculateNewMomentum(
    state: ConversationState,
    message: Message,
    timeSinceLastMessage: number,
    context: any
  ): number {
    let momentum = state.momentum;

    // City influence
    momentum += context.metrics.efficiency * 0.1;
    momentum += context.metrics.safety * 0.05;

    // Time decay
    momentum -= (timeSinceLastMessage / (5 * 60 * 1000)) * this.DECAY_RATE;

    // Message factors
    if (message.content.includes("?")) momentum += 0.1;
    if (message.content.length > 100) momentum += 0.05;
    if (message.content.length < 20) momentum -= 0.05;
    if (message.topics?.length) momentum += 0.1;

    // Resource utilization impact
    const avgResourceUse =
      (context.state.resourceUtilization.power +
        context.state.resourceUtilization.water +
        context.state.resourceUtilization.transport) /
      3;
    momentum *= (1 + avgResourceUse) / 2;

    return Math.max(this.MIN_MOMENTUM, Math.min(this.MAX_MOMENTUM, momentum));
  }

  private calculateSilenceProbability(
    state: ConversationState,
    context: any
  ): number {
    let probability = 0.1;

    // City factors
    if (context.metrics.safety < 0.5) probability += 0.2;
    if (context.metrics.livability < 0.6) probability += 0.1;

    // Resource strain
    if (context.state.resourceUtilization.power > 0.8) probability += 0.1;
    if (context.state.resourceUtilization.transport > 0.8) probability += 0.1;

    // Conversation factors
    if (state.momentum < 0.3) probability += 0.3;
    if (state.interactionCount > 20) probability += 0.1;

    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 6) probability += 0.2;

    return Math.min(0.9, probability);
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }

  getState(conversationId: string): ConversationState {
    if (!this.states.has(conversationId)) {
      this.initializeState(conversationId);
    }
    return this.states.get(conversationId)!;
  }

  private initializeState(conversationId: string): void {
    const context = this.cityContext.getContext();
    const cityMood = context.metrics.livability;

    this.states.set(conversationId, {
      conversationId,
      lastMessageTimestamp: Date.now(),
      lastInteractionTime: Date.now(),
      messageCount: 0,
      participants: [],
      topics: [],
      currentTopics: new Set(),
      sentiment: cityMood,
      status: "inactive",
      momentum: 0.5,
      silenceDuration: 0,
      silenceProbability: 0.1,
      interactionCount: 0,
      timeOfDay: this.getTimeOfDay(),
      topicExhaustion: new Map(),
      currentStyle: context.metrics.efficiency > 0.7 ? "formal" : "casual",
      emotionalState: cityMood,
      turnsInCurrentTopic: 0,
    });
  }
}
