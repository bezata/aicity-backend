export interface WeatherImpact {
  type: "rain" | "snow" | "heat" | "storm";
  affects: {
    transport: number; // Efficiency reduction
    mood: number; // Citizen satisfaction impact
    energy: number; // Power consumption change
    activities: string[]; // Affected outdoor activities
  };
}
