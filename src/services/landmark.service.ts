import { EventBus } from "./event-bus.service";
import { VectorStoreService } from "./vector-store.service";
import { AnalyticsService } from "./analytics.service";
import { RecordMetadata } from "@pinecone-database/pinecone";

interface LandmarkVisit {
  landmarkId: string;
  timestamp: number;
  visitorCount: number;
  culturalImpact: number;
}

interface LandmarkRating {
  landmarkId: string;
  rating: number;
  feedback: string;
  timestamp: number;
  agentId: string;
}

interface CulturalSignificance {
  historicalValue: number;
  culturalValue: number;
  socialImpact: number;
  aiInteractionLevel: number;
  lastAssessment: number;
}

interface Landmark {
  id: string;
  name: string;
  coordinates: [number, number];
  type:
    | "historical"
    | "cultural"
    | "commercial"
    | "educational"
    | "recreational"
    | "ai_hub";
  description?: string;
  districtId: string;
  status: "active" | "maintenance" | "closed";
  capacity: number;
  culturalSignificance: CulturalSignificance;
  accessibilityFeatures: string[];
  virtualTourAvailable: boolean;
  aiServices: {
    guidedTours: boolean;
    informationKiosk: boolean;
    virtualAssistant: boolean;
    translationServices: boolean;
  };
  operatingHours: {
    open: number; // 24-hour format
    close: number; // 24-hour format
  };
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface LandmarkQueryResult {
  id: string;
  score: number;
  metadata: RecordMetadata & {
    type: string;
    landmarkId: string;
    landmarkType: string;
    districtId: string;
    culturalValue: number;
  };
}

const LANDMARK_SYSTEM_AGENT = {
  id: "landmark-system",
  name: "Landmark System",
  personality: "analytical",
  systemPrompt: "Track landmark interactions",
  interests: ["landmarks", "cultural", "analytics"],
  preferredStyle: "analytical" as const,
  traits: {
    analyticalThinking: 1,
    creativity: 0.5,
    empathy: 0.5,
    curiosity: 0.7,
    enthusiasm: 0.6,
    formality: 0.8,
  },
  memoryWindowSize: 10,
  emotionalRange: { min: 0.3, max: 0.8 },
};

export class LandmarkService {
  private landmarks: Map<string, Landmark> = new Map();
  private visits: Map<string, LandmarkVisit[]> = new Map();
  private ratings: Map<string, LandmarkRating[]> = new Map();
  private readonly eventBus: EventBus;

  constructor(
    private vectorStore: VectorStoreService,
    private analyticsService: AnalyticsService
  ) {
    this.eventBus = EventBus.getInstance();
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    setInterval(() => this.updateCulturalMetrics(), 1000 * 60 * 60); // Every hour
    setInterval(() => this.analyzeVisitationPatterns(), 1000 * 60 * 30); // Every 30 minutes
  }

  async getAllLandmarks(): Promise<Landmark[]> {
    return Array.from(this.landmarks.values());
  }

  async addLandmark(landmark: Landmark): Promise<void> {
    landmark.createdAt = Date.now();
    landmark.updatedAt = Date.now();

    this.landmarks.set(landmark.id, landmark);

    // Store in vector database for semantic search
    await this.vectorStore.upsert({
      id: `landmark-${landmark.id}`,
      values: await this.vectorStore.createEmbedding(
        `${landmark.name} ${landmark.type} landmark in district ${landmark.districtId}: ${landmark.description}`
      ),
      metadata: {
        type: "district",
        landmarkId: landmark.id,
        landmarkType: landmark.type,
        districtId: landmark.districtId,
        culturalValue: landmark.culturalSignificance.culturalValue,
      },
    });

    this.eventBus.emitCulturalEvent({
      type: "landmark_added",
      landmarkId: landmark.id,
      landmarkType: landmark.type,
      districtId: landmark.districtId,
      culturalSignificance: landmark.culturalSignificance,
    });
  }

  async getLandmarkById(id: string): Promise<Landmark | undefined> {
    const landmark = this.landmarks.get(id);
    if (landmark) {
      await this.trackLandmarkAccess(id);
    }
    return landmark;
  }

  async searchLandmarks(query: string): Promise<Landmark[]> {
    // First, try semantic search using vector store
    const embedding = await this.vectorStore.createEmbedding(query);
    const semanticResults = await this.vectorStore.query({
      vector: embedding,
      filter: { type: { $eq: "district" } },
      topK: 10,
      includeMetadata: true,
    });

    const semanticLandmarkIds =
      semanticResults.matches
        ?.filter(
          (result: { metadata: { type: string } }) =>
            result.metadata.type === "district"
        )
        .map(
          (result: { metadata: { landmarkId: string } }) =>
            result.metadata.landmarkId
        ) || [];

    // Then, combine with traditional search
    const lowerQuery = query.toLowerCase();
    const textResults = Array.from(this.landmarks.values()).filter(
      (landmark) =>
        landmark.name.toLowerCase().includes(lowerQuery) ||
        landmark.description?.toLowerCase().includes(lowerQuery) ||
        landmark.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );

    // Combine and deduplicate results
    const combinedResults = [
      ...new Set([...semanticLandmarkIds, ...textResults.map((l) => l.id)]),
    ];
    return combinedResults.map((id) => this.landmarks.get(id)!).filter(Boolean);
  }

  async updateLandmark(id: string, updates: Partial<Landmark>): Promise<void> {
    const landmark = this.landmarks.get(id);
    if (!landmark) return;

    const updatedLandmark = {
      ...landmark,
      ...updates,
      updatedAt: Date.now(),
    };

    this.landmarks.set(id, updatedLandmark);

    // Update vector store
    await this.vectorStore.upsert({
      id: `landmark-${id}`,
      values: await this.vectorStore.createEmbedding(
        `${updatedLandmark.name} ${updatedLandmark.type} landmark in district ${updatedLandmark.districtId}: ${updatedLandmark.description}`
      ),
      metadata: {
        type: "district",
        landmarkId: id,
        landmarkType: updatedLandmark.type,
        districtId: updatedLandmark.districtId,
        culturalValue: updatedLandmark.culturalSignificance.culturalValue,
      },
    });

    this.eventBus.emitCulturalEvent({
      type: "landmark_updated",
      landmarkId: id,
      changes: updates,
    });
  }

  async recordVisit(
    landmarkId: string,
    visitorCount: number = 1
  ): Promise<void> {
    const visit: LandmarkVisit = {
      landmarkId,
      timestamp: Date.now(),
      visitorCount,
      culturalImpact: await this.calculateVisitImpact(landmarkId, visitorCount),
    };

    const landmarkVisits = this.visits.get(landmarkId) || [];
    landmarkVisits.push(visit);
    this.visits.set(landmarkId, landmarkVisits);

    // Track analytics
    await this.analyticsService.trackInteraction(LANDMARK_SYSTEM_AGENT, {
      id: crypto.randomUUID(),
      agentId: "landmark-system",
      content: `Landmark visit: ${visitorCount} visitors`,
      timestamp: Date.now(),
      role: "assistant",
      sentiment: 0.8,
      topics: ["landmark", "visit", "cultural"],
    });
  }

  async addRating(rating: LandmarkRating): Promise<void> {
    const landmarkRatings = this.ratings.get(rating.landmarkId) || [];
    landmarkRatings.push(rating);
    this.ratings.set(rating.landmarkId, landmarkRatings);

    await this.updateLandmarkMetrics(rating.landmarkId);
  }

  async getLandmarksByDistrict(districtId: string): Promise<Landmark[]> {
    return Array.from(this.landmarks.values()).filter(
      (landmark) => landmark.districtId === districtId
    );
  }

  async getLandmarksByType(type: Landmark["type"]): Promise<Landmark[]> {
    return Array.from(this.landmarks.values()).filter(
      (landmark) => landmark.type === type
    );
  }

  async getVisitationStats(landmarkId: string): Promise<{
    totalVisits: number;
    averageVisitorsPerDay: number;
    peakHours: number[];
    culturalImpact: number;
  }> {
    const visits = this.visits.get(landmarkId) || [];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentVisits = visits.filter((v) => v.timestamp > oneDayAgo);
    const totalVisits = recentVisits.reduce(
      (sum, v) => sum + v.visitorCount,
      0
    );

    const hourlyVisits = new Array(24).fill(0);
    recentVisits.forEach((visit) => {
      const hour = new Date(visit.timestamp).getHours();
      hourlyVisits[hour] += visit.visitorCount;
    });

    return {
      totalVisits,
      averageVisitorsPerDay: totalVisits / 1,
      peakHours: hourlyVisits
        .map((count, hour) => ({ count, hour }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((peak) => peak.hour),
      culturalImpact:
        recentVisits.reduce((sum, v) => sum + v.culturalImpact, 0) /
        recentVisits.length,
    };
  }

  private async calculateVisitImpact(
    landmarkId: string,
    visitorCount: number
  ): Promise<number> {
    const landmark = this.landmarks.get(landmarkId);
    if (!landmark) return 0;

    return (
      (landmark.culturalSignificance.culturalValue * 0.4 +
        landmark.culturalSignificance.socialImpact * 0.3 +
        landmark.culturalSignificance.aiInteractionLevel * 0.3) *
      (visitorCount / landmark.capacity)
    );
  }

  private async updateLandmarkMetrics(landmarkId: string): Promise<void> {
    const landmark = this.landmarks.get(landmarkId);
    const ratings = this.ratings.get(landmarkId) || [];
    if (!landmark) return;

    const averageRating =
      ratings.reduce((sum, r) => sum + r.rating, 0) /
      Math.max(ratings.length, 1);

    await this.updateLandmark(landmarkId, {
      culturalSignificance: {
        ...landmark.culturalSignificance,
        socialImpact:
          averageRating * 0.8 +
          landmark.culturalSignificance.socialImpact * 0.2,
        lastAssessment: Date.now(),
      },
    });
  }

  private async updateCulturalMetrics(): Promise<void> {
    for (const landmark of this.landmarks.values()) {
      const visits = this.visits.get(landmark.id) || [];
      const recentVisits = visits.filter(
        (v) => v.timestamp > Date.now() - 24 * 60 * 60 * 1000
      );

      const culturalImpact =
        recentVisits.reduce((sum, v) => sum + v.culturalImpact, 0) /
        Math.max(recentVisits.length, 1);

      await this.updateLandmark(landmark.id, {
        culturalSignificance: {
          ...landmark.culturalSignificance,
          culturalValue:
            culturalImpact * 0.7 +
            landmark.culturalSignificance.culturalValue * 0.3,
          lastAssessment: Date.now(),
        },
      });
    }
  }

  private async analyzeVisitationPatterns(): Promise<void> {
    for (const landmark of this.landmarks.values()) {
      const stats = await this.getVisitationStats(landmark.id);

      // Adjust operating hours based on peak times
      if (stats.peakHours.length > 0) {
        const suggestedOpen = Math.min(...stats.peakHours) - 1;
        const suggestedClose = Math.max(...stats.peakHours) + 1;

        if (
          Math.abs(suggestedOpen - landmark.operatingHours.open) > 2 ||
          Math.abs(suggestedClose - landmark.operatingHours.close) > 2
        ) {
          await this.updateLandmark(landmark.id, {
            operatingHours: {
              open: suggestedOpen,
              close: suggestedClose,
            },
          });
        }
      }
    }
  }

  private async trackLandmarkAccess(landmarkId: string): Promise<void> {
    await this.analyticsService.trackInteraction(LANDMARK_SYSTEM_AGENT, {
      id: crypto.randomUUID(),
      agentId: "landmark-system",
      content: "Landmark information accessed",
      timestamp: Date.now(),
      role: "assistant",
      sentiment: 0.6,
      topics: ["landmark", "information"],
    });
  }
}
