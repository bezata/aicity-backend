import { EventEmitter } from "events";
import { CultureService } from "./culture.service";
import { Agent } from "../types/agent.types";
import { VectorStoreService } from "./vector-store.service";
import { CulturalEvent, CulturalMetrics } from "../types/culture.types";
import { District } from "../types/district.types";
import _ from "lodash";

interface CulturalContext {
  traditions: Array<{
    name: string;
    significance: number;
    participants: number;
    seasonality?: string;
  }>;
  activeEvents: Array<{
    id: string;
    type: string;
    title: string;
    impact: number;
    engagement: number;
  }>;
  values: Array<{
    name: string;
    importance: number;
    adherence: number;
  }>;
  demographics: {
    diversity: number;
    mainGroups: string[];
    languages: string[];
  };
}

interface CulturalAwareness {
  localTraditions: CulturalContext["traditions"];
  currentEvents: CulturalContext["activeEvents"];
  communityValues: CulturalContext["values"];
  culturalPreferences: string[];
  culturalSensitivity: number;
  crossCulturalExperience: number;
  communityEngagement: {
    level: number;
    activities: string[];
    impact: number;
  };
}

interface CulturalInteraction {
  agentId: string;
  districtId: string;
  eventId?: string;
  type: "participation" | "organization" | "observation";
  impact: number;
  timestamp: number;
  details: Record<string, any>;
}

export class AgentCultureService extends EventEmitter {
  private culturalInteractions: Map<string, CulturalInteraction[]> = new Map();
  private districtContextCache: Map<
    string,
    { context: CulturalContext; timestamp: number }
  > = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  constructor(
    private cultureService: CultureService,
    private vectorStore: VectorStoreService
  ) {
    super();
    this.initializeCulturalService();
  }

  private async initializeCulturalService() {
    // Setup event listeners
    this.cultureService.on(
      "culturalEventCreated",
      this.handleNewCulturalEvent.bind(this)
    );
    this.cultureService.on(
      "culturalMetricsUpdated",
      this.updateCulturalMetrics.bind(this)
    );

    // Start periodic tasks
    setInterval(() => this.refreshCulturalContexts(), this.CACHE_DURATION);
  }

  async enrichAgentContext(
    agent: Agent,
    districtId: string
  ): Promise<Agent & { culturalAwareness: CulturalAwareness }> {
    const culturalContext = await this.getCulturalContext(districtId);
    const interactions = this.culturalInteractions.get(agent.id) || [];

    const culturalAwareness: CulturalAwareness = {
      localTraditions: culturalContext.traditions,
      currentEvents: culturalContext.activeEvents,
      communityValues: culturalContext.values,
      culturalPreferences: this.matchCulturalPreferences(
        agent,
        culturalContext
      ),
      culturalSensitivity: this.calculateCulturalSensitivity(
        agent,
        interactions
      ),
      crossCulturalExperience:
        this.calculateCrossculturalExperience(interactions),
      communityEngagement: await this.analyzeCommunitiyEngagement(
        agent.id,
        districtId
      ),
    };

    const enrichedAgent = {
      ...agent,
      culturalAwareness,
    };

    // Store the enriched context for future reference
    await this.storeEnrichedContext(agent.id, districtId, culturalAwareness);

    return enrichedAgent;
  }

  private async getCulturalContext(
    districtId: string
  ): Promise<CulturalContext> {
    // Check cache first
    const cached = this.districtContextCache.get(districtId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.context;
    }

    const embedding = await this.vectorStore.createEmbedding(
      `district ${districtId} cultural context`
    );

    const results = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "district" },
        districtId: { $eq: districtId },
      },
      topK: 5,
    });

    const context = this.processCulturalData(results.matches);

    // Update cache
    this.districtContextCache.set(districtId, {
      context,
      timestamp: Date.now(),
    });

    return context;
  }

  private processCulturalData(matches: any[]): CulturalContext {
    const traditions = new Map<string, any>();
    const events = new Map<string, any>();
    const values = new Map<string, any>();
    const demographics = new Set<string>();
    const languages = new Set<string>();

    matches.forEach((match) => {
      if (match.metadata.tradition) {
        traditions.set(match.metadata.tradition, {
          name: match.metadata.tradition,
          significance: match.metadata.significance || 0.5,
          participants: match.metadata.participants || 0,
          seasonality: match.metadata.seasonality,
        });
      }

      if (match.metadata.event) {
        events.set(match.metadata.event, {
          id: match.metadata.eventId,
          type: match.metadata.eventType,
          title: match.metadata.event,
          impact: match.metadata.impact || 0.5,
          engagement: match.metadata.engagement || 0.5,
        });
      }

      if (match.metadata.value) {
        values.set(match.metadata.value, {
          name: match.metadata.value,
          importance: match.metadata.importance || 0.5,
          adherence: match.metadata.adherence || 0.5,
        });
      }

      if (match.metadata.demographics) {
        match.metadata.demographics.forEach((d: string) => demographics.add(d));
      }

      if (match.metadata.languages) {
        match.metadata.languages.forEach((l: string) => languages.add(l));
      }
    });

    return {
      traditions: Array.from(traditions.values()),
      activeEvents: Array.from(events.values()),
      values: Array.from(values.values()),
      demographics: {
        diversity: demographics.size / 10, // Normalize to 0-1
        mainGroups: Array.from(demographics),
        languages: Array.from(languages),
      },
    };
  }

  private matchCulturalPreferences(
    agent: Agent,
    context: CulturalContext
  ): string[] {
    const preferences = new Set<string>();

    // Match based on traditions
    context.traditions.forEach((tradition) => {
      if (
        agent.interests.some(
          (interest) =>
            tradition.name.toLowerCase().includes(interest.toLowerCase()) ||
            this.areConceptsRelated(interest, tradition.name)
        )
      ) {
        preferences.add(tradition.name);
      }
    });

    // Match based on active events
    context.activeEvents.forEach((event) => {
      if (
        agent.interests.some(
          (interest) =>
            event.title.toLowerCase().includes(interest.toLowerCase()) ||
            event.type.toLowerCase().includes(interest.toLowerCase())
        )
      ) {
        preferences.add(event.title);
      }
    });

    // Match based on community values
    context.values.forEach((value) => {
      if (
        agent.interests.some(
          (interest) =>
            value.name.toLowerCase().includes(interest.toLowerCase()) ||
            this.areConceptsRelated(interest, value.name)
        )
      ) {
        preferences.add(value.name);
      }
    });

    return Array.from(preferences);
  }

  private areConceptsRelated(concept1: string, concept2: string): boolean {
    const relatedConcepts: Record<string, string[]> = {
      art: ["culture", "creativity", "expression", "heritage"],
      music: ["performance", "festival", "tradition", "celebration"],
      technology: ["innovation", "smart", "digital", "modern"],
      environment: ["sustainability", "green", "nature", "eco"],
      community: ["social", "collective", "public", "gathering"],
      // Add more related concept mappings
    };

    const related1 = relatedConcepts[concept1.toLowerCase()] || [];
    const related2 = relatedConcepts[concept2.toLowerCase()] || [];

    return (
      related1.some((r) => concept2.toLowerCase().includes(r)) ||
      related2.some((r) => concept1.toLowerCase().includes(r))
    );
  }

  private calculateCulturalSensitivity(
    agent: Agent,
    interactions: CulturalInteraction[]
  ): number {
    const baseScore = agent.traits.empathy || 0.5;

    // Calculate bonus from interactions
    const interactionScore =
      interactions.reduce((score, interaction) => {
        return score + interaction.impact * 0.1;
      }, 0) / Math.max(interactions.length, 1);

    return Math.min(1, baseScore + interactionScore);
  }

  private calculateCrossculturalExperience(
    interactions: CulturalInteraction[]
  ): number {
    const uniqueEvents = new Set(
      interactions.map((i) => i.eventId).filter(Boolean)
    );
    const uniqueDistricts = new Set(interactions.map((i) => i.districtId));

    return Math.min(1, uniqueEvents.size * 0.1 + uniqueDistricts.size * 0.2);
  }

  private async analyzeCommunitiyEngagement(
    agentId: string,
    districtId: string
  ) {
    const interactions = this.culturalInteractions.get(agentId) || [];
    const districtInteractions = interactions.filter(
      (i) => i.districtId === districtId
    );

    return {
      level: this.calculateEngagementLevel(districtInteractions),
      activities: this.summarizeActivities(districtInteractions),
      impact: this.calculateCommunityImpact(districtInteractions),
    };
  }

  private calculateEngagementLevel(
    interactions: CulturalInteraction[]
  ): number {
    const recentInteractions = interactions.filter(
      (i) => Date.now() - i.timestamp < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );

    return Math.min(1, recentInteractions.length * 0.1);
  }

  private summarizeActivities(interactions: CulturalInteraction[]): string[] {
    const activityCounts = _.countBy(interactions, "type");
    return Object.entries(activityCounts).map(
      ([type, count]) => `${type} (${count} times)`
    );
  }

  private calculateCommunityImpact(
    interactions: CulturalInteraction[]
  ): number {
    return (
      interactions.reduce(
        (total, interaction) => total + interaction.impact,
        0
      ) / Math.max(interactions.length, 1)
    );
  }

  private async storeEnrichedContext(
    agentId: string,
    districtId: string,
    awareness: CulturalAwareness
  ) {
    await this.vectorStore.upsert({
      id: `cultural-awareness-${agentId}-${districtId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        JSON.stringify({
          preferences: awareness.culturalPreferences,
          sensitivity: awareness.culturalSensitivity,
          engagement: awareness.communityEngagement,
        })
      ),
      metadata: {
        type: "district",
        agentId,
        districtId,
        timestamp: Date.now(),
        awareness: JSON.stringify(awareness),
      },
    });
  }

  private async handleNewCulturalEvent(event: CulturalEvent) {
    // Invalidate relevant district cache
    this.districtContextCache.delete(event.location.districtId);

    // Notify relevant agents
    this.emit("newCulturalEvent", event);
  }

  private async updateCulturalMetrics(metrics: CulturalMetrics) {
    // Update cached contexts based on new metrics
    this.districtContextCache.clear();

    // Notify about significant changes
    this.emit("culturalMetricsUpdated", metrics);
  }

  private async refreshCulturalContexts() {
    for (const [districtId] of this.districtContextCache) {
      try {
        const newContext = await this.getCulturalContext(districtId);
        this.districtContextCache.set(districtId, {
          context: newContext,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(
          `Error refreshing cultural context for district ${districtId}:`,
          error
        );
      }
    }
  }

  // Public methods for interaction tracking
  async recordCulturalInteraction(
    interaction: Omit<CulturalInteraction, "timestamp">
  ) {
    const fullInteraction: CulturalInteraction = {
      ...interaction,
      timestamp: Date.now(),
    };

    const agentInteractions =
      this.culturalInteractions.get(interaction.agentId) || [];
    agentInteractions.push(fullInteraction);
    this.culturalInteractions.set(interaction.agentId, agentInteractions);

    await this.storeInteraction(fullInteraction);
    this.emit("culturalInteraction", fullInteraction);
  }

  private async storeInteraction(interaction: CulturalInteraction) {
    await this.vectorStore.upsert({
      id: `cultural-interaction-${interaction.agentId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        JSON.stringify(interaction)
      ),
      metadata: {
        type: "district",
        subtype: "cultural_interaction",
        agentId: interaction.agentId,
        interactionType: interaction.type,
        details: JSON.stringify(interaction.details),
      },
    });
  }

  // Analysis methods
  async analyzeAgentCulturalFit(agent: Agent, district: District) {
    const culturalContext = await this.getCulturalContext(district.id);
    const enrichedAgent = await this.enrichAgentContext(agent, district.id);

    return {
      overallFit: this.calculateCulturalFit(enrichedAgent, culturalContext),
      recommendations: await this.generateCulturalRecommendations(
        enrichedAgent,
        culturalContext
      ),
      potentialContributions: this.identifyPotentialContributions(
        enrichedAgent,
        culturalContext
      ),
    };
  }
  private calculateCulturalFit(
    agent: Agent & { culturalAwareness: CulturalAwareness },
    context: CulturalContext
  ): number {
    // Calculate how well the agent's preferences match with available cultural elements
    const preferencesMatch =
      agent.culturalAwareness.culturalPreferences.length /
      Math.max(context.traditions.length + context.activeEvents.length, 1);

    // Calculate how well the agent's values align with community values
    const valueAlignment =
      context.values.reduce((sum, value) => {
        return (
          sum +
          (agent.culturalAwareness.communityValues.some(
            (v) => v.name === value.name
          )
            ? 1
            : 0)
        );
      }, 0) / Math.max(context.values.length, 1);

    // Get engagement score from agent's community engagement
    const engagementScore = agent.culturalAwareness.communityEngagement.level;

    // Get cultural sensitivity score
    const sensitivityScore = agent.culturalAwareness.culturalSensitivity;

    // Calculate diversity adaptation score based on demographics
    const diversityScore = this.calculateDiversityAdaptation(
      agent.culturalAwareness,
      context.demographics
    );

    // Calculate weighted average of all components
    return (
      preferencesMatch * 0.25 +
      valueAlignment * 0.25 +
      engagementScore * 0.2 +
      sensitivityScore * 0.15 +
      diversityScore * 0.15
    );
  }

  private calculateDiversityAdaptation(
    awareness: CulturalAwareness,
    demographics: CulturalContext["demographics"]
  ): number {
    // Base score from cross-cultural experience
    let score = awareness.crossCulturalExperience;

    // Bonus for multilingual engagement if applicable
    if (demographics.languages.length > 1) {
      score += 0.1;
    }

    // Bonus for high cultural sensitivity in diverse communities
    if (demographics.diversity > 0.7 && awareness.culturalSensitivity > 0.8) {
      score += 0.2;
    }

    return Math.min(1, score); // Cap at 1.0
  }

  private async generateCulturalRecommendations(
    agent: Agent & { culturalAwareness: CulturalAwareness },
    context: CulturalContext
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Events based on preferences
    agent.culturalAwareness.culturalPreferences.forEach((preference) => {
      const matchingEvents = context.activeEvents.filter((event) =>
        event.title.toLowerCase().includes(preference.toLowerCase())
      );
      matchingEvents.forEach((event) =>
        recommendations.push(`Consider participating in: ${event.title}`)
      );
    });

    // Community engagement opportunities
    if (agent.culturalAwareness.communityEngagement.level < 0.6) {
      recommendations.push(
        "Increase community participation through local events"
      );
    }

    return recommendations;
  }

  private identifyPotentialContributions(
    agent: Agent & { culturalAwareness: CulturalAwareness },
    context: CulturalContext
  ): string[] {
    const contributions: string[] = [];

    // Based on agent's expertise
    agent.interests.forEach((interest) => {
      const relevantTraditions = context.traditions.filter((t) =>
        this.areConceptsRelated(interest, t.name)
      );
      relevantTraditions.forEach((tradition) =>
        contributions.push(
          `Share expertise in ${interest} for ${tradition.name}`
        )
      );
    });

    // Based on cultural sensitivity
    if (agent.culturalAwareness.culturalSensitivity > 0.7) {
      contributions.push("Help facilitate cross-cultural understanding");
    }

    return contributions;
  }
}
