import type { ConversationState, Message } from "../types/conversation.types";

export class ConversationDynamics {
  private states = new Map<string, ConversationState>();
  private readonly DECAY_RATE = 0.1;
  private readonly MIN_MOMENTUM = 0.1;
  private readonly MAX_MOMENTUM = 0.9;

  constructor() {}

  getState(conversationId: string): ConversationState {
    if (!this.states.has(conversationId)) {
      this.initializeState(conversationId);
    }
    return this.states.get(conversationId)!;
  }

  updateState(conversationId: string, message: Message): void {
    let state = this.getState(conversationId);

    // Update time-based metrics
    const now = Date.now();
    const timeSinceLastMessage = now - state.lastInteractionTime;
    state.silenceDuration = timeSinceLastMessage;
    state.lastInteractionTime = now;

    // Update momentum
    state.momentum = this.calculateNewMomentum(
      state,
      message,
      timeSinceLastMessage
    );

    // Update topic exhaustion
    if (message.topics) {
      message.topics.forEach((topic) => {
        const currentExhaustion = state.topicExhaustion.get(topic) || 0;
        state.topicExhaustion.set(topic, Math.min(1, currentExhaustion + 0.2));
      });
    }

    // Update current topics
    if (message.topics) {
      state.currentTopics = new Set(message.topics);
    }

    // Update silence probability
    state.silenceProbability = this.calculateSilenceProbability(state);

    // Update interaction count
    state.interactionCount++;

    // Update time of day
    state.timeOfDay = this.getTimeOfDay();

    this.states.set(conversationId, state);
  }

  private initializeState(conversationId: string): void {
    this.states.set(conversationId, {
      momentum: 0.5,
      lastInteractionTime: Date.now(),
      currentTopics: new Set(),
      topicExhaustion: new Map(),
      silenceProbability: 0.1,
      currentStyle: "casual",
      emotionalState: 0,
      turnsInCurrentTopic: 0,
      silenceDuration: 0,
      timeOfDay: this.getTimeOfDay(),
      interactionCount: 0,
    });
  }

  private calculateNewMomentum(
    state: ConversationState,
    message: Message,
    timeSinceLastMessage: number
  ): number {
    let momentum = state.momentum;

    // Time decay
    momentum -= (timeSinceLastMessage / (5 * 60 * 1000)) * this.DECAY_RATE;

    // Message content factors
    if (message.content.includes("?")) momentum += 0.1;
    if (message.content.length > 100) momentum += 0.05;
    if (message.content.length < 20) momentum -= 0.05;
    if (message.topics && message.topics.length > 0) momentum += 0.1;

    // Bound momentum
    return Math.max(this.MIN_MOMENTUM, Math.min(this.MAX_MOMENTUM, momentum));
  }

  private calculateSilenceProbability(state: ConversationState): number {
    let probability = 0.1;

    // Increase with low momentum
    if (state.momentum < 0.3) probability += 0.3;

    // Increase with high topic exhaustion
    const avgExhaustion =
      Array.from(state.topicExhaustion.values()).reduce(
        (sum, val) => sum + val,
        0
      ) / Math.max(1, state.topicExhaustion.size);
    if (avgExhaustion > 0.7) probability += 0.2;

    // Time of day factor
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 6) probability += 0.2;

    // Cap probability
    return Math.min(0.9, probability);
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }
}
