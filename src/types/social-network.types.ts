export interface CitizenRelationship {
  type: "friend" | "colleague" | "neighbor" | "family";
  strength: number; // 0-1
  interactions: Array<{
    type: string;
    location: string;
    timestamp: number;
  }>;
}
