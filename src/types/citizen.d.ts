declare module "../services/citizen.service" {
  export interface CitizenService {
    updateActivityLevels(type: string, intensity: number): Promise<void>;
  }
}

interface CitizenActivity {
  type: string;
  intensity: number;
  timestamp: number;
}

interface Citizen {
  // ... existing properties ...
  currentActivity?: CitizenActivity;
}
