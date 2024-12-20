export type SocialActivityType =
  | "community_meeting"
  | "cultural_event"
  | "protest"
  | "celebration"
  | "market"
  | "education"
  | "sports"
  | "entertainment";

export interface SocialActivity {
  id: string;
  type: SocialActivityType;
  title: string;
  description: string;
  location: {
    districtId: string;
    venue: string;
  };
  organizer: {
    departmentId?: string;
    citizenId?: string;
  };
  participants: {
    expected: number;
    current: number;
    demographics: {
      districts: Record<string, number>;
      satisfaction: number;
    };
  };
  schedule: {
    start: number;
    end: number;
    recurring?: "daily" | "weekly" | "monthly";
  };
  impact: {
    community: number; // 0-1
    economy: number; // 0-1
    satisfaction: number; // 0-1
  };
  status: "planned" | "active" | "completed" | "cancelled";
  relatedEvents: string[];
}
