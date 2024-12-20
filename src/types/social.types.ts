export interface SocialEvent {
  type: "festival" | "protest" | "market" | "concert";
  location: string;
  participants: number;
  mood: number;
  impact: {
    economy: number;
    culture: number;
    community: number;
  };
}
