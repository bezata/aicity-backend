export type CulturalEventType =
  | "art_exhibition"
  | "street_performance"
  | "food_festival"
  | "cultural_celebration"
  | "music_concert"
  | "theater_show"
  | "film_screening"
  | "workshop"
  | "heritage_tour"
  | "cultural_exchange";

export interface CulturalEvent {
  id: string;
  type: CulturalEventType;
  title: string;
  description: string;
  artists: Artist[];
  schedule: {
    start: number;
    end: number;
    recurring?: "daily" | "weekly" | "monthly";
  };
  location: {
    districtId: string;
    venue: string;
    coordinates: [number, number];
  };
  culturalOrigin: string[];
  participation: {
    capacity: number;
    registered: number;
    demographics: Record<string, number>;
  };
  impact: {
    culturalEnrichment: number; // 0-1
    communityEngagement: number; // 0-1
    touristAttraction: number; // 0-1
    economicBenefit: number; // 0-1
  };
  status: "upcoming" | "active" | "completed" | "cancelled";
}

export interface Artist {
  id: string;
  name: string;
  specialty: string[];
  culturalBackground: string[];
  portfolio: string[];
  rating: number; // 0-5
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
    communityFeedback: FeedbackMetrics;
  };
  impact: {
    culturalPreservation: number; // 0-1
    crossCulturalExchange: number; // 0-1
    artisticInnovation: number; // 0-1
    communityHarmony: number; // 0-1
  };
}

interface FeedbackMetrics {
  satisfaction: number; // 0-1
  relevance: number; // 0-1
  accessibility: number; // 0-1
  culturalAuthenticity: number; // 0-1
}
