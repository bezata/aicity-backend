export type CulturalEventType =
  | "art_exhibition"
  | "street_performance"
  | "food_festival"
  | "heritage_tour"
  | "workshop"
  | "cultural_celebration"
  | "religious_ceremony"
  | "spiritual_gathering"
  | "religious_festival";

export type CulturalEventStatus =
  | "upcoming"
  | "active"
  | "completed"
  | "cancelled";

export interface CulturalEvent {
  id: string;
  title: string;
  description: string;
  type: CulturalEventType;
  location: {
    districtId: string;
    venue: string;
    coordinates: [number, number];
  };
  startTime: string;
  endTime: string;
  participants: string[];
  culturalSignificance: number;
  impact: {
    social: number;
    cultural: number;
    economic: number;
    culturalEnrichment?: number;
  };
  status: CulturalEventStatus;
  metrics?: {
    attendance: number;
    satisfaction: number;
    culturalPreservation: number;
    communityEngagement: number;
  };
  artists?: string[];
  schedule?: Array<{
    time: string;
    activity: string;
  }>;
  culturalOrigin?: string;
}

export interface CulturalMetrics {
  diversity: {
    eventTypes: Record<CulturalEventType, number>;
    culturalRepresentation: Record<string, number>;
    participationDemographics: Record<string, number>;
  };
  engagement: {
    totalParticipants: number;
    averageRating: number;
    repeatVisitors: number;
    communityFeedback: {
      satisfaction: number;
      relevance: number;
      accessibility: number;
      culturalAuthenticity: number;
    };
  };
  impact: {
    culturalPreservation: number;
    crossCulturalExchange: number;
    artisticInnovation: number;
    communityHarmony: number;
  };
}

export interface Artist {
  id: string;
  name: string;
  specialties: string[];
  culturalBackground: string[];
  achievements: Array<{
    title: string;
    date: string;
    significance: number;
  }>;
  collaborations: string[];
  rating: number;
}

export interface CulturalStory {
  title: string;
  narrative: string;
  culturalContext: string;
  historicalPeriod: string;
  location: string;
}

export interface HeritageSpot {
  name: string;
  location: {
    districtId: string;
    venue: string;
    coordinates: [number, number];
  };
  historicalSignificance: string;
  culturalValue: string;
}

export interface CulturalAtmosphere {
  mood: string;
  dominantCultures: string[];
  activeEvents: string[];
  culturalTension: number;
  harmonyIndex: number;
}

export interface CultureService {
  createEvent(event: CulturalEvent): Promise<CulturalEvent>;
  updateEvent(
    id: string,
    event: Partial<CulturalEvent>
  ): Promise<CulturalEvent>;
  deleteEvent(id: string): Promise<void>;
  getEvent(id: string): Promise<CulturalEvent>;
  listEvents(): Promise<CulturalEvent[]>;
  getAtmosphere(districtId: string): Promise<CulturalAtmosphere>;
  updateMetrics(
    eventId: string,
    metrics: Partial<CulturalMetrics>
  ): Promise<void>;
}
