declare module "../services/social-dynamics.service" {
  export interface SocialDynamicsService {
    getCommunityMood(districtId: string): Promise<{
      positivity: number;
      engagement: number;
    }>;
  }
}
