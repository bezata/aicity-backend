import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { CultureService } from "../types/culture.types";
import _ from "lodash";
import { LandmarkService } from "../services/landmark.service";
import { DistrictService } from "./district.service";
import { SmartInfrastructureService } from "./smart-infrastructure.service";
import { CityEvent } from "../types/city-events";
import { AnalyticsService } from "./analytics.service";
import { Agent } from "../types/agent.types";
import { Message } from "../types/conversation.types";

interface CityMemory {
  type: "historical" | "cultural" | "social" | "environmental";
  description: string;
  districtId: string;
  timestamp: number;
  emotionalImpact: number;
  participants: string[];
  culturalSignificance: number;
  tags?: string[];
  location?: {
    coordinates: [number, number];
    landmark?: string;
  };
  mediaReferences?: string[];
  relatedMemories?: string[];
}

interface MemoryAnalytics {
  significance: number;
  relevance: number;
  communityImpact: number;
  preservationPriority: number;
}

interface MemoryCollection {
  memories: CityMemory[];
  analytics: {
    totalCount: number;
    typeDistribution: Record<CityMemory["type"], number>;
    averageImpact: number;
    significantThemes: string[];
    temporalPatterns: Array<{
      period: string;
      count: number;
      significance: number;
    }>;
  };
}

interface InfrastructureData {
  nearestLandmark?: string;
  coordinates?: [number, number];
  type?: string;
  status?: string;
}

interface DistrictMetrics {
  culturalIndex: number;
  socialIndex: number;
  economicIndex: number;
}

export class CityMemoryService extends EventEmitter {
  private memoryCache: Map<string, MemoryCollection> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly SIGNIFICANCE_THRESHOLD = 0.7;
  private readonly memoryAgent: Agent = {
    id: "city-memory",
    name: "Memory Service",
    personality: "Analytical and preservative",
    systemPrompt: "Manage and preserve city memories and cultural heritage",
    interests: ["cultural preservation", "history", "community memory"],
    preferredStyle: "formal",
    memoryWindowSize: 1000,
    emotionalRange: { min: 0.3, max: 0.8 },
    traits: {
      analyticalThinking: 0.8,
      creativity: 0.6,
      empathy: 0.7,
      curiosity: 0.9,
      enthusiasm: 0.6,
      reliability: 0.9,
      environmentalAwareness: 0.7,
    },
  };

  constructor(
    private vectorStore: VectorStoreService,
    private culturalService: CultureService,
    private landmarkService: LandmarkService,
    private districtService: DistrictService,
    private smartInfrastructureService: SmartInfrastructureService,
    private analyticsService: AnalyticsService
  ) {
    super();
    this.initializeMemoryService();
  }

  private async initializeMemoryService() {
    // Track service initialization
    this.analyticsService.trackInteraction(this.memoryAgent, {
      id: crypto.randomUUID(),
      agentId: this.memoryAgent.id,
      content: "City Memory Service initialized",
      timestamp: Date.now(),
      role: "assistant",
      sentiment: 0.8,
      topics: ["memory", "initialization"],
    });

    setInterval(() => this.analyzeCityMemoryPatterns(), 24 * 60 * 60 * 1000); // Daily analysis
    setInterval(
      () => this.updateMemoryPreservationPriorities(),
      12 * 60 * 60 * 1000
    ); // Every 12 hours

    // Listen to district events for memory context
    this.districtService.on(
      "districtUpdated",
      this.handleDistrictUpdate.bind(this)
    );
    this.smartInfrastructureService.on(
      "infrastructureChange",
      this.handleInfrastructureChange.bind(this)
    );
  }

  private async handleDistrictUpdate(districtEvent: any) {
    // Update memory context based on district changes
    const districtMemories = await this.getDistrictMemories(
      districtEvent.districtId
    );
    for (const memory of districtMemories.memories) {
      await this.updateMemoryContext(memory, districtEvent);
    }
  }

  private async handleInfrastructureChange(change: any) {
    // Update location context in affected memories
    const affectedMemories = await this.findMemoriesByLocation(change.location);
    for (const memory of affectedMemories) {
      await this.updateLocationContext(memory, change);
    }
  }

  private async updateMemoryContext(memory: CityMemory, districtEvent: any) {
    const updatedMemory = { ...memory };
    const district = await this.districtService.getDistrict(memory.districtId);

    if (district) {
      updatedMemory.culturalSignificance = this.recalculateSignificance(
        memory,
        district
      );
      await this.storeCollectiveMemory(updatedMemory);
    }

    // Track context update
    this.analyticsService.trackInteraction(this.memoryAgent, {
      id: crypto.randomUUID(),
      agentId: this.memoryAgent.id,
      content: `Updated memory context for ${memory.type} memory`,
      timestamp: Date.now(),
      role: "assistant",
      sentiment: 0.6,
      topics: ["memory", "context", "update"],
    });
  }

  private async updateLocationContext(
    memory: CityMemory,
    infrastructureChange: any
  ) {
    const locationData = await this.getInfrastructureData(
      memory.location?.coordinates || [0, 0]
    );

    if (locationData?.nearestLandmark) {
      memory.location = {
        coordinates: memory.location?.coordinates || [0, 0],
        landmark: locationData.nearestLandmark,
      };
      await this.storeCollectiveMemory(memory);
    }
  }

  // Helper method to get infrastructure data
  private async getInfrastructureData(
    coordinates: [number, number]
  ): Promise<InfrastructureData> {
    try {
      const nearbyInfrastructure =
        await this.smartInfrastructureService.getNearbyInfrastructure(
          coordinates
        );
      const landmarks = await this.landmarkService.getAllLandmarks();

      const nearestLandmark = landmarks.find(
        (l) => this.calculateDistance(coordinates, l.coordinates) < 1000 // Within 1km
      );

      return {
        nearestLandmark: nearestLandmark?.name,
        coordinates,
        type: nearbyInfrastructure?.type,
        status: nearbyInfrastructure?.status,
      };
    } catch (error) {
      console.error("Error getting infrastructure data:", error);
      return {};
    }
  }

  // Helper method to get district metrics
  private async getDistrictMetrics(
    districtId: string
  ): Promise<DistrictMetrics> {
    try {
      const district = await this.districtService.getDistrict(districtId);
      const culturalData = await this.culturalService.getDistrictCulture(
        districtId
      );

      return {
        culturalIndex: culturalData?.culturalIndex || 1,
        socialIndex: district?.socialMetrics?.index || 1,
        economicIndex: district?.economicMetrics?.index || 1,
      };
    } catch (error) {
      console.error("Error getting district metrics:", error);
      return {
        culturalIndex: 1,
        socialIndex: 1,
        economicIndex: 1,
      };
    }
  }

  private async findMemoriesByLocation(
    coordinates: [number, number]
  ): Promise<CityMemory[]> {
    const nearbyMemories = await this.vectorStore.query({
      vector: await this.vectorStore.createEmbedding(
        `location memories ${coordinates.join(",")}`
      ),
      filter: {
        type: { $eq: "district" },
        subtype: { $eq: "collective_memory" },
      },
      topK: 10,
    });

    return this.processMemoryResults(nearbyMemories.matches);
  }

  private recalculateSignificance(memory: CityMemory, district: any): number {
    const baseSignificance = memory.culturalSignificance;
    const districtFactor = district.culturalImportance || 1;
    const timeFactor = this.calculateTemporalRelevance(memory.timestamp);

    return baseSignificance * 0.5 + districtFactor * 0.3 + timeFactor * 0.2;
  }

  private async analyzeCityMemoryPatterns() {
    try {
      const allMemories = await this.getAllStoredMemories();
      const patterns = this.analyzeTemporalPatterns(allMemories);

      this.emit("memoryPatternsAnalyzed", {
        patterns,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error analyzing memory patterns:", error);
    }
  }
  private async getAllStoredMemories(): Promise<CityMemory[]> {
    try {
      const results = await this.vectorStore.query({
        vector: await this.vectorStore.createEmbedding("all city memories"),
        filter: {
          type: { $eq: "district" },
          subtype: { $eq: "collective_memory" },
        },
        topK: 1000, // Adjust based on your needs
      });

      if (!results.matches) {
        return [];
      }

      return results.matches.map((match: any) => ({
        type: match.metadata.type as CityMemory["type"],
        description: match.metadata.description,
        districtId: match.metadata.districtId,
        timestamp: match.metadata.timestamp,
        emotionalImpact: match.metadata.impact,
        participants: JSON.parse(match.metadata.participants || "[]"),
        culturalSignificance: match.metadata.significance,
      }));
    } catch (error) {
      console.error("Error retrieving stored memories:", error);
      throw error;
    }
  }

  // Change from updatePreservationPriorities to:
  private async updateMemoryPreservationPriorities() {
    try {
      const allMemories = await this.getAllStoredMemories();

      for (const memory of allMemories) {
        const analytics = await this.analyzeMemory(memory);
        const priority = this.calculatePreservationPriority(
          analytics.significance,
          analytics.relevance,
          analytics.communityImpact
        );

        if (priority >= this.SIGNIFICANCE_THRESHOLD) {
          await this.initiatePreservationProtocol(memory);
        }
      }
    } catch (error) {
      console.error("Error updating preservation priorities:", error);
    }
  }
  async storeCollectiveMemory(memory: CityMemory): Promise<void> {
    try {
      // Track memory storage
      this.analyticsService.trackInteraction(this.memoryAgent, {
        id: crypto.randomUUID(),
        agentId: this.memoryAgent.id,
        content: `Storing ${memory.type} memory: ${memory.description}`,
        timestamp: Date.now(),
        role: "assistant",
        sentiment: 0.7,
        topics: ["memory", "storage", memory.type],
      });

      // Enrich with district context
      const district = await this.districtService.getDistrict(
        memory.districtId
      );
      if (district) {
        const districtMetrics = await this.getDistrictMetrics(
          memory.districtId
        );
        memory.culturalSignificance *= districtMetrics.culturalIndex;
      }

      // Enrich with infrastructure context
      if (memory.location) {
        const infrastructureData = await this.getInfrastructureData(
          memory.location.coordinates
        );
        if (infrastructureData.nearestLandmark) {
          memory.location.landmark = infrastructureData.nearestLandmark;
        }
      }

      // Enrich memory with additional context
      const enrichedMemory = await this.enrichMemoryContext(memory);

      // Calculate memory analytics
      const analytics = await this.analyzeMemory(enrichedMemory);

      // Store in vector database
      await this.vectorStore.upsert({
        id: `city-memory-${Date.now()}`,
        values: await this.vectorStore.createEmbedding(
          `${enrichedMemory.type}: ${
            enrichedMemory.description
          } ${enrichedMemory.tags?.join(" ")}`
        ),
        metadata: {
          type: "district",
          subtype: "collective_memory",
          districtId: enrichedMemory.districtId,
          impact: enrichedMemory.emotionalImpact,
          significance: enrichedMemory.culturalSignificance,
          timestamp: enrichedMemory.timestamp,
          analytics: JSON.stringify(analytics),
        },
      });

      // Invalidate cache for affected district
      this.memoryCache.delete(enrichedMemory.districtId);

      // Emit memory stored event
      this.emit("memoryStored", {
        memory: enrichedMemory,
        analytics,
      });

      // Trigger preservation check if highly significant
      if (analytics.significance > this.SIGNIFICANCE_THRESHOLD) {
        await this.initiatePreservationProtocol(enrichedMemory);
      }
    } catch (error) {
      console.error("Error storing collective memory:", error);
      throw error;
    }
  }

  async getDistrictMemories(
    districtId: string,
    options: {
      type?: CityMemory["type"];
      fromTimestamp?: number;
      toTimestamp?: number;
      minSignificance?: number;
      includedTags?: string[];
      excludedTags?: string[];
    } = {}
  ): Promise<MemoryCollection> {
    try {
      // Check cache first
      const cached = this.memoryCache.get(districtId);
      if (cached && !this.isCacheStale(districtId)) {
        return this.filterMemories(cached, options);
      }

      // Query vector store for memories
      const embedding = await this.vectorStore.createEmbedding(
        `district ${districtId} collective memories ${options.type || ""}`
      );

      const results = await this.vectorStore.query({
        vector: embedding,
        filter: {
          type: { $eq: "district" },
          subtype: { $eq: "collective_memory" },
          districtId: { $eq: districtId },
        },
        topK: 100,
      });

      // Process and analyze results
      const memories = await this.processMemoryResults(results.matches);
      const collection = await this.analyzeMemoryCollection(memories);

      // Update cache
      this.memoryCache.set(districtId, collection);

      return this.filterMemories(collection, options);
    } catch (error) {
      console.error("Error retrieving district memories:", error);
      throw error;
    }
  }

  private async enrichMemoryContext(memory: CityMemory): Promise<CityMemory> {
    // Add relevant tags
    const tags = await this.generateMemoryTags(memory);

    // Find related memories
    const relatedMemories = await this.findRelatedMemories(memory);

    // Get location context if not provided
    const location =
      memory.location || (await this.inferMemoryLocation(memory));

    return {
      ...memory,
      tags,
      relatedMemories: relatedMemories.map((m) => m.id),
      location,
    };
  }

  private async generateMemoryTags(memory: CityMemory): Promise<string[]> {
    const tags = new Set<string>();

    // Add type-based tags
    tags.add(memory.type);

    // Extract key themes from description
    const themes = await this.extractThemes(memory.description);
    themes.forEach((theme) => tags.add(theme));

    // Add participant-based tags
    memory.participants.forEach((participant) => {
      tags.add(`participant:${participant}`);
    });

    // Add temporal tags
    const timeContext = this.getTemporalContext(memory.timestamp);
    tags.add(timeContext);

    return Array.from(tags);
  }

  private async extractThemes(text: string): Promise<string[]> {
    const themes = new Set<string>();

    // Common theme patterns
    const themePatterns = {
      celebration: /celebrat|festival|ceremony|gathering/i,
      conflict: /conflict|dispute|resolution|challenge/i,
      progress: /development|improvement|growth|innovation/i,
      tradition: /tradition|heritage|cultural|ancestral/i,
      change: /transform|change|evolution|adapt/i,
    };

    // Check for theme patterns
    Object.entries(themePatterns).forEach(([theme, pattern]) => {
      if (pattern.test(text)) {
        themes.add(theme);
      }
    });

    return Array.from(themes);
  }

  private getTemporalContext(timestamp: number): string {
    const date = new Date(timestamp);
    const currentYear = new Date().getFullYear();
    const years = currentYear - date.getFullYear();

    if (years < 1) return "recent";
    if (years < 5) return "recent-past";
    if (years < 20) return "modern-history";
    if (years < 50) return "historical";
    return "ancient";
  }

  private async analyzeMemory(memory: CityMemory): Promise<MemoryAnalytics> {
    const significance = this.calculateSignificance(memory);
    const relevance = await this.assessRelevance(memory);
    const communityImpact = await this.assessCommunityImpact(memory);
    const preservationPriority = this.calculatePreservationPriority(
      significance,
      relevance,
      communityImpact
    );

    return {
      significance,
      relevance,
      communityImpact,
      preservationPriority,
    };
  }

  private calculateSignificance(memory: CityMemory): number {
    return (
      memory.culturalSignificance * 0.4 +
      memory.emotionalImpact * 0.3 +
      (memory.participants.length / 100) * 0.3
    );
  }

  private async assessRelevance(memory: CityMemory): Promise<number> {
    // Calculate temporal relevance
    const temporalRelevance = this.calculateTemporalRelevance(memory.timestamp);

    // Calculate thematic relevance
    const thematicRelevance = await this.calculateThematicRelevance(memory);

    return (temporalRelevance + thematicRelevance) / 2;
  }

  private calculateTemporalRelevance(timestamp: number): number {
    const age = Date.now() - timestamp;
    const maxAge = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
    return Math.min(1, Math.max(0.3, 1 - age / maxAge));
  }

  private async calculateThematicRelevance(
    memory: CityMemory
  ): Promise<number> {
    const themes = await this.extractThemes(memory.description);
    const relevantThemes = themes.filter((theme) =>
      this.isThemeCurrentlyRelevant(theme)
    );

    return relevantThemes.length / Math.max(themes.length, 1);
  }

  private isThemeCurrentlyRelevant(theme: string): boolean {
    const currentThemes = new Set([
      "celebration",
      "progress",
      "tradition",
      "change",
    ]);
    return currentThemes.has(theme);
  }

  private async assessCommunityImpact(memory: CityMemory): Promise<number> {
    // Calculate participant impact
    const participantImpact = memory.participants.length / 100;

    // Calculate emotional resonance
    const emotionalResonance = memory.emotionalImpact;

    // Calculate cultural significance
    const culturalSignificance = memory.culturalSignificance;

    return (
      participantImpact * 0.3 +
      emotionalResonance * 0.3 +
      culturalSignificance * 0.4
    );
  }

  private calculatePreservationPriority(
    significance: number,
    relevance: number,
    communityImpact: number
  ): number {
    return significance * 0.4 + relevance * 0.3 + communityImpact * 0.3;
  }

  private async findRelatedMemories(
    memory: CityMemory
  ): Promise<Array<{ id: string; similarity: number }>> {
    const embedding = await this.vectorStore.createEmbedding(
      `${memory.type} ${memory.description}`
    );

    const results = await this.vectorStore.query({
      vector: embedding,
      filter: {
        type: { $eq: "district" },
        subtype: { $eq: "collective_memory" },
        districtId: { $eq: memory.districtId },
      },
      topK: 5,
    });

    return results.matches.map((match: any) => ({
      id: match.id,
      similarity: match.score,
    }));
  }

  private async inferMemoryLocation(
    memory: CityMemory
  ): Promise<CityMemory["location"]> {
    // Extract location mentions from description
    const locationMentions = await this.extractLocationMentions(
      memory.description
    );

    if (locationMentions.length > 0) {
      return {
        coordinates: locationMentions[0].coordinates,
        landmark: locationMentions[0].name,
      };
    }

    // Default to district center if no specific location found
    return {
      coordinates: [0, 0], // Replace with actual district center coordinates
    };
  }

  private async extractLocationMentions(text: string): Promise<
    Array<{
      name: string;
      coordinates: [number, number];
    }>
  > {
    const mentions: Array<{
      name: string;
      coordinates: [number, number];
    }> = [];

    // Get all landmarks
    const landmarks = await this.landmarkService.getAllLandmarks();
    const lowerText = text.toLowerCase();

    // Direct matching
    for (const landmark of landmarks) {
      if (lowerText.includes(landmark.name.toLowerCase())) {
        mentions.push({
          name: landmark.name,
          coordinates: landmark.coordinates,
        });
      }
    }

    // Store the extracted locations for future reference
    await this.vectorStore.upsert({
      id: `location-mentions-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(text),
      metadata: {
        type: "district",
        mentions: mentions.map((m) => m.name).join(","),
        timestamp: Date.now(),
      },
    });

    return mentions;
  }

  private async processMemoryResults(matches: any[]): Promise<CityMemory[]> {
    return matches.map((match: any) => ({
      type: match.metadata.type as CityMemory["type"],
      description: match.metadata.description,
      districtId: match.metadata.districtId,
      timestamp: match.metadata.timestamp,
      emotionalImpact: match.metadata.impact,
      participants: JSON.parse(match.metadata.participants || "[]"),
      culturalSignificance: match.metadata.significance,
    }));
  }

  private async analyzeMemoryCollection(
    memories: CityMemory[]
  ): Promise<MemoryCollection> {
    const typeDistribution = _.countBy(memories, "type");
    const averageImpact = _.meanBy(memories, "emotionalImpact");

    // Extract and analyze themes
    const allThemes = await Promise.all(
      memories.map((m) => this.extractThemes(m.description))
    );
    const significantThemes = this.findSignificantThemes(_.flatten(allThemes));

    // Analyze temporal patterns
    const temporalPatterns = this.analyzeTemporalPatterns(memories);

    return {
      memories,
      analytics: {
        totalCount: memories.length,
        typeDistribution: typeDistribution as Record<
          CityMemory["type"],
          number
        >,
        averageImpact,
        significantThemes,
        temporalPatterns,
      },
    };
  }

  private findSignificantThemes(themes: string[]): string[] {
    const themeCounts = _.countBy(themes);
    const significantThreshold = Math.max(3, themes.length * 0.1);

    return Object.entries(themeCounts)
      .filter(([_, count]) => count >= significantThreshold)
      .map(([theme]) => theme);
  }

  private analyzeTemporalPatterns(memories: CityMemory[]): Array<{
    period: string;
    count: number;
    significance: number;
  }> {
    const periods = memories.map((m) => this.getTemporalContext(m.timestamp));
    const periodCounts = _.countBy(periods);

    return Object.entries(periodCounts).map(([period, count]) => ({
      period,
      count,
      significance: count / memories.length,
    }));
  }

  private filterMemories(
    collection: MemoryCollection,
    options: {
      type?: CityMemory["type"];
      fromTimestamp?: number;
      toTimestamp?: number;
      minSignificance?: number;
      includedTags?: string[];
      excludedTags?: string[];
    }
  ): MemoryCollection {
    let filteredMemories = collection.memories;

    // Apply filters
    if (options.type) {
      filteredMemories = filteredMemories.filter(
        (m) => m.type === options.type
      );
    }

    if (options.fromTimestamp) {
      filteredMemories = filteredMemories.filter(
        (m) => m.timestamp >= options.fromTimestamp!
      );
    }

    if (options.toTimestamp) {
      filteredMemories = filteredMemories.filter(
        (m) => m.timestamp <= options.toTimestamp!
      );
    }

    if (options.minSignificance) {
      filteredMemories = filteredMemories.filter(
        (m) => m.culturalSignificance >= options.minSignificance!
      );
    }

    if (options.includedTags?.length) {
      filteredMemories = filteredMemories.filter((m) =>
        options.includedTags!.some((tag) => m.tags?.includes(tag))
      );
    }

    if (options.excludedTags?.length) {
      filteredMemories = filteredMemories.filter(
        (m) => !options.excludedTags!.some((tag) => m.tags?.includes(tag))
      );
    }

    // Recalculate analytics for filtered memories
    return {
      memories: filteredMemories,
      analytics: {
        totalCount: filteredMemories.length,
        typeDistribution: this.calculateTypeDistribution(filteredMemories),
        averageImpact: this.calculateAverageImpact(filteredMemories),
        significantThemes: this.extractSignificantThemes(filteredMemories),
        temporalPatterns: this.calculateTemporalPatterns(filteredMemories),
      },
    };
  }

  private calculateTypeDistribution(
    memories: CityMemory[]
  ): Record<CityMemory["type"], number> {
    return memories.reduce((acc, memory) => {
      acc[memory.type] = (acc[memory.type] || 0) + 1;
      return acc;
    }, {} as Record<CityMemory["type"], number>);
  }

  private calculateAverageImpact(memories: CityMemory[]): number {
    if (memories.length === 0) return 0;
    return (
      memories.reduce((sum, memory) => sum + memory.emotionalImpact, 0) /
      memories.length
    );
  }

  private extractSignificantThemes(memories: CityMemory[]): string[] {
    const themeCounts = new Map<string, number>();

    // Count themes from all memories
    memories.forEach((memory) => {
      memory.tags?.forEach((tag) => {
        themeCounts.set(tag, (themeCounts.get(tag) || 0) + 1);
      });
    });

    // Find themes that appear in at least 25% of memories
    const significanceThreshold = memories.length * 0.25;
    return Array.from(themeCounts.entries())
      .filter(([_, count]) => count >= significanceThreshold)
      .map(([theme]) => theme);
  }

  private calculateTemporalPatterns(memories: CityMemory[]): Array<{
    period: string;
    count: number;
    significance: number;
  }> {
    // Group memories by time periods
    const periodCounts = new Map<string, number>();
    memories.forEach((memory) => {
      const period = this.getTemporalPeriod(memory.timestamp);
      periodCounts.set(period, (periodCounts.get(period) || 0) + 1);
    });

    return Array.from(periodCounts.entries()).map(([period, count]) => ({
      period,
      count,
      significance: count / memories.length,
    }));
  }

  private getTemporalPeriod(timestamp: number): string {
    const now = Date.now();
    const age = now - timestamp;

    if (age < 30 * 24 * 60 * 60 * 1000) return "recent"; // Last 30 days
    if (age < 365 * 24 * 60 * 60 * 1000) return "past-year"; // Last year
    if (age < 5 * 365 * 24 * 60 * 60 * 1000) return "past-5-years"; // Last 5 years
    if (age < 10 * 365 * 24 * 60 * 60 * 1000) return "past-decade"; // Last decade
    return "historical"; // Older than 10 years
  }

  private isCacheStale(districtId: string): boolean {
    const cached = this.memoryCache.get(districtId);
    if (!cached) return true;

    const lastUpdate = Math.min(...cached.memories.map((m) => m.timestamp));
    return Date.now() - lastUpdate > this.CACHE_DURATION;
  }

  private async initiatePreservationProtocol(memory: CityMemory) {
    // Emit preservation request event
    this.emit("preservationNeeded", {
      memory,
      priority: memory.culturalSignificance,
      timestamp: Date.now(),
    });

    // Store preservation metadata
    await this.vectorStore.upsert({
      id: `preservation-${memory.districtId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(
        `Preservation request for ${memory.type} memory: ${memory.description}`
      ),
      metadata: {
        type: "district",
        subtype: "preservation_request",
        districtId: memory.districtId,
        memoryId: memory.districtId,
        priority: memory.culturalSignificance,
        timestamp: Date.now(),
      },
    });

    // Schedule periodic significance reassessment
    setTimeout(() => {
      this.reassessSignificance(memory);
    }, 30 * 24 * 60 * 60 * 1000); // Reassess after 30 days
  }

  private async reassessSignificance(memory: CityMemory) {
    const currentAnalytics = await this.analyzeMemory(memory);

    if (
      Math.abs(currentAnalytics.significance - memory.culturalSignificance) >
      0.2
    ) {
      // Significance has changed significantly
      this.emit("significanceChanged", {
        memory,
        previousSignificance: memory.culturalSignificance,
        newSignificance: currentAnalytics.significance,
        timestamp: Date.now(),
      });
    }
  }

  // Public method to search memories by content
  async searchMemories(
    query: string,
    options: {
      districtId?: string;
      type?: CityMemory["type"];
      minSignificance?: number;
    } = {}
  ): Promise<CityMemory[]> {
    const embedding = await this.vectorStore.createEmbedding(query);

    const filter: any = {
      type: { $eq: "district" },
      subtype: { $eq: "collective_memory" },
    };

    if (options.districtId) {
      filter.districtId = { $eq: options.districtId };
    }

    const results = await this.vectorStore.query({
      vector: embedding,
      filter,
      topK: 20,
    });

    let memories = await this.processMemoryResults(results.matches);

    if (options.type) {
      memories = memories.filter((m) => m.type === options.type);
    }
    if (options.minSignificance !== undefined) {
      memories = memories.filter(
        (m) => m.culturalSignificance >= options.minSignificance!
      );
    }

    return memories;
  }

  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}
