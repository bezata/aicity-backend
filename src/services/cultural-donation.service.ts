import { EventEmitter } from "events";
import { CultureService } from "./culture.service";
import { DevelopmentService } from "./development.service";
import { VectorStoreService } from "./vector-store.service";

interface CulturalProject {
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
  targetAmount: number;
  donationsReceived: number;
  expectedImpact: {
    culturalPreservation: number;
    communityEngagement: number;
    touristAttraction: number;
    spiritualSignificance?: number;
    interfaithHarmony?: number;
  };
  status: "active" | "funded" | "in_progress" | "completed";
  donors: Array<{
    id: string;
    amount: number;
    timestamp: number;
    anonymous?: boolean;
    message?: string;
  }>;
  religiousAffiliation?: {
    tradition: string;
    leaderApproval?: string;
    communitySupport: number;
  };
  constructionPhases?: Array<{
    name: string;
    description: string;
    cost: number;
    status: "planned" | "in_progress" | "completed";
    startDate?: number;
    completionDate?: number;
  }>;
}

interface CulturalDonation {
  donorId: string;
  projectId: string;
  amount: number;
  message?: string;
  anonymous?: boolean;
  recurringInterval?: "monthly" | "quarterly" | "yearly";
  earmarkForPhase?: string;
}

interface DonationCampaign {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDate: number;
  endDate: number;
  targetAmount: number;
  currentAmount: number;
  status: "planned" | "active" | "completed" | "extended";
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
}

export class CulturalDonationService extends EventEmitter {
  private donationProjects: Map<string, CulturalProject> = new Map();
  private campaigns: Map<string, DonationCampaign> = new Map();
  private recurringDonations: Map<string, CulturalDonation> = new Map();

  constructor(
    private cultureService: CultureService,
    private developmentService: DevelopmentService,
    private vectorStore: VectorStoreService
  ) {
    super();
    this.initializeRecurringDonations();
  }

  private initializeRecurringDonations() {
    setInterval(() => this.processRecurringDonations(), 24 * 60 * 60 * 1000); // Daily check
  }

  async createDonationProject(project: Omit<CulturalProject, "id">) {
    const newProject: CulturalProject = {
      id: crypto.randomUUID(),
      ...project,
      status: "active",
      donationsReceived: 0,
      donors: [],
      constructionPhases: this.generateConstructionPhases(
        project.type,
        project.targetAmount
      ),
    };

    await this.vectorStore.upsert({
      id: `cultural-project-${newProject.id}`,
      values: await this.vectorStore.createEmbedding(
        `${newProject.type} ${newProject.title} ${newProject.description} ${
          newProject.religiousAffiliation?.tradition || ""
        }`
      ),
      metadata: {
        type: "district",
        subtype: "cultural_project",
        projectId: newProject.id,
        districtId: newProject.districtId,
        culturalImpact: JSON.stringify(newProject.expectedImpact),
        religiousTradition: newProject.religiousAffiliation?.tradition,
      },
    });

    this.donationProjects.set(newProject.id, newProject);
    return newProject;
  }

  async createDonationCampaign(
    projectId: string,
    campaign: Omit<
      DonationCampaign,
      "id" | "projectId" | "currentAmount" | "status"
    >
  ) {
    const project = this.donationProjects.get(projectId);
    if (!project) throw new Error("Project not found");

    const newCampaign: DonationCampaign = {
      id: crypto.randomUUID(),
      projectId,
      currentAmount: 0,
      status: "planned",
      ...campaign,
    };

    this.campaigns.set(newCampaign.id, newCampaign);
    this.emit("campaignCreated", { campaign: newCampaign, project });
    return newCampaign;
  }

  async processDonation(donation: CulturalDonation) {
    const project = this.donationProjects.get(donation.projectId);
    if (!project) throw new Error("Project not found");

    if (donation.recurringInterval) {
      this.recurringDonations.set(
        `${donation.donorId}-${donation.projectId}`,
        donation
      );
    }

    project.donationsReceived += donation.amount;
    project.donors.push({
      id: donation.donorId,
      amount: donation.amount,
      timestamp: Date.now(),
      anonymous: donation.anonymous,
      message: donation.message,
    });

    // Update campaign if exists
    const campaign = Array.from(this.campaigns.values()).find(
      (c) => c.projectId === project.id && c.status === "active"
    );
    if (campaign) {
      campaign.currentAmount += donation.amount;
      if (campaign.currentAmount >= campaign.targetAmount) {
        campaign.status = "completed";
        this.emit("campaignCompleted", { campaign, project });
      }
    }

    // Update construction phases
    if (donation.earmarkForPhase && project.constructionPhases) {
      const phase = project.constructionPhases.find(
        (p) => p.name === donation.earmarkForPhase
      );
      if (
        phase &&
        phase.status === "planned" &&
        donation.amount >= phase.cost
      ) {
        phase.status = "in_progress";
        phase.startDate = Date.now();
      }
    }

    if (project.donationsReceived >= project.targetAmount) {
      await this.initiateProjectImplementation(project);
    }

    this.donationProjects.set(project.id, project);
    this.emit("donationProcessed", { donation, project });
  }

  private async processRecurringDonations() {
    for (const [key, donation] of this.recurringDonations) {
      const [donorId, projectId] = key.split("-");
      const project = this.donationProjects.get(projectId);
      if (!project || project.status !== "active") {
        this.recurringDonations.delete(key);
        continue;
      }

      await this.processDonation({
        ...donation,
        donorId,
        projectId,
      });
    }
  }

  private generateConstructionPhases(
    type: CulturalProject["type"],
    totalAmount: number
  ): CulturalProject["constructionPhases"] {
    if (
      !type.includes("religious_building") &&
      !type.includes("interfaith_center")
    ) {
      return undefined;
    }

    return [
      {
        name: "foundation",
        description: "Laying the foundation and basic structure",
        cost: totalAmount * 0.3,
        status: "planned",
      },
      {
        name: "mainStructure",
        description: "Building the main structure and walls",
        cost: totalAmount * 0.4,
        status: "planned",
      },
      {
        name: "interiorAndFinishing",
        description: "Interior work and finishing touches",
        cost: totalAmount * 0.2,
        status: "planned",
      },
      {
        name: "sacredSpaces",
        description: "Creating and decorating sacred spaces",
        cost: totalAmount * 0.1,
        status: "planned",
      },
    ];
  }

  private async initiateProjectImplementation(project: CulturalProject) {
    await this.developmentService.submitProject({
      type: project.type,
      status: "proposed",
      location: {
        districtId: project.districtId,
        coordinates: project.location,
      },
      timeline: {
        proposed: Date.now(),
      },
      metrics: {
        costEfficiency: 0.8,
        communityBenefit: 0.9,
        economicGrowth: 0.7,
        qualityOfLife: 0.85,
      },
      sustainability: {
        energyEfficiency: 0.8,
        greenScore: 0.7,
        environmentalImpact: 0.75,
      },
      culturalImpact: {
        culturalPreservation: project.expectedImpact.culturalPreservation,
        communityEngagement: project.expectedImpact.communityEngagement,
        touristAttraction: project.expectedImpact.touristAttraction,
        religiousConsideration: project.religiousAffiliation ? 0.9 : undefined,
      },
      budget: project.donationsReceived,
    });

    project.status = "in_progress";
    this.emit("projectImplementationStarted", project);
  }
}
