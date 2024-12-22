export interface CulturalProject {
  id: string;
  type:
    | "heritage"
    | "venue"
    | "public_art"
    | "community_space"
    | "religious_building"
    | "interfaith_center";
  title: string;
  description: string;
  districtId: string;
  location: [number, number];
  status: "pending" | "active" | "completed" | "cancelled";
  targetAmount: number;
  raisedAmount: number;
  donorCount: number;
  expectedImpact: {
    culturalPreservation: number;
    communityEngagement: number;
    touristAttraction: number;
    spiritualSignificance?: number;
    interfaithHarmony?: number;
  };
  religiousAffiliation?: {
    tradition: string;
    leaderApproval?: string;
    communitySupport: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface DonationCampaign {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDate: number;
  endDate: number;
  targetAmount: number;
  raisedAmount: number;
  donorCount: number;
  status: "scheduled" | "active" | "completed" | "cancelled";
  specialEvents: Array<{
    name: string;
    date: number;
    type: "fundraiser" | "ceremony" | "community_gathering";
  }>;
  rewards: Array<{
    level: number;
    description: string;
    recognition: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface CulturalDonation {
  id: string;
  projectId: string;
  campaignId?: string;
  donorId: string;
  amount: number;
  message?: string;
  anonymous?: boolean;
  recurringInterval?: "monthly" | "quarterly" | "yearly";
  earmarkForPhase?: string;
  status: "pending" | "processed" | "failed";
  processedAt?: number;
  createdAt: number;
}

export interface CulturalDonationService {
  getProjects(filters?: {
    type?: string;
    status?: string;
    district?: string;
  }): Promise<CulturalProject[]>;

  getProject(projectId: string): Promise<CulturalProject | undefined>;

  getCampaigns(projectId: string): Promise<DonationCampaign[]>;

  getCampaign(campaignId: string): Promise<DonationCampaign | undefined>;

  createDonationProject(
    project: Omit<
      CulturalProject,
      | "id"
      | "status"
      | "raisedAmount"
      | "donorCount"
      | "createdAt"
      | "updatedAt"
    >
  ): Promise<CulturalProject>;

  createDonationCampaign(
    projectId: string,
    campaign: Omit<
      DonationCampaign,
      | "id"
      | "projectId"
      | "status"
      | "raisedAmount"
      | "donorCount"
      | "createdAt"
      | "updatedAt"
    >
  ): Promise<DonationCampaign>;

  processDonation(
    donation: Omit<
      CulturalDonation,
      "id" | "status" | "processedAt" | "createdAt"
    >
  ): Promise<void>;
}
