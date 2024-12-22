import { EventEmitter } from "events";
import { CultureService } from "./culture.service";
import { DevelopmentService } from "./development.service";
import { VectorStoreService } from "./vector-store.service";
import {
  CulturalProject,
  DonationCampaign,
  CulturalDonation,
  CulturalDonationService as ICulturalDonationService,
} from "../types/cultural-donation.types";

export class CulturalDonationService
  extends EventEmitter
  implements ICulturalDonationService
{
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

  async getProjects(filters?: {
    type?: string;
    status?: string;
    district?: string;
  }): Promise<CulturalProject[]> {
    const projects = Array.from(this.donationProjects.values());
    if (!filters) return projects;

    return projects.filter(
      (project) =>
        (!filters.type || project.type === filters.type) &&
        (!filters.status || project.status === filters.status) &&
        (!filters.district || project.districtId === filters.district)
    );
  }

  async getProject(projectId: string): Promise<CulturalProject | undefined> {
    return this.donationProjects.get(projectId);
  }

  async getCampaigns(projectId: string): Promise<DonationCampaign[]> {
    return Array.from(this.campaigns.values()).filter(
      (campaign) => campaign.projectId === projectId
    );
  }

  async getCampaign(campaignId: string): Promise<DonationCampaign | undefined> {
    return this.campaigns.get(campaignId);
  }

  async createDonationProject(
    project: Omit<
      CulturalProject,
      | "id"
      | "status"
      | "raisedAmount"
      | "donorCount"
      | "createdAt"
      | "updatedAt"
    >
  ): Promise<CulturalProject> {
    const now = Date.now();
    const newProject: CulturalProject = {
      ...project,
      id: `proj_${now}_${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      raisedAmount: 0,
      donorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Store project in vector database for semantic search
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
    this.emit("project:created", newProject);
    return newProject;
  }

  async createDonationCampaign(
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
  ): Promise<DonationCampaign> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    const newCampaign: DonationCampaign = {
      ...campaign,
      id: `camp_${now}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      status: "scheduled",
      raisedAmount: 0,
      donorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.campaigns.set(newCampaign.id, newCampaign);
    this.emit("campaign:created", { campaign: newCampaign, project });
    return newCampaign;
  }

  async processDonation(
    donation: Omit<
      CulturalDonation,
      "id" | "status" | "processedAt" | "createdAt"
    >
  ): Promise<void> {
    const project = await this.getProject(donation.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    const newDonation: CulturalDonation = {
      ...donation,
      id: `don_${now}_${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      createdAt: now,
    };

    try {
      // Process the donation
      project.raisedAmount += donation.amount;
      project.donorCount += 1;
      project.updatedAt = now;

      if (donation.campaignId) {
        const campaign = await this.getCampaign(donation.campaignId);
        if (campaign) {
          campaign.raisedAmount += donation.amount;
          campaign.donorCount += 1;
          campaign.updatedAt = now;
        }
      }

      if (donation.recurringInterval) {
        this.recurringDonations.set(newDonation.id, {
          ...newDonation,
          status: "processed",
          processedAt: now,
        });
      }

      // Check if project target is reached
      if (project.raisedAmount >= project.targetAmount) {
        await this.initiateProjectImplementation(project);
      }

      this.donationProjects.set(project.id, project);
      this.emit("donation:processed", { donation: newDonation, project });
    } catch (error) {
      this.emit("donation:failed", { donation: newDonation, error });
      throw error;
    }
  }

  private initializeRecurringDonations() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, donation] of this.recurringDonations) {
        if (this.shouldProcessRecurring(donation, now)) {
          const {
            id: _,
            status: __,
            processedAt: ___,
            createdAt: ____,
            ...donationData
          } = donation;
          this.processDonation(donationData);
        }
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  private shouldProcessRecurring(
    donation: CulturalDonation,
    now: number
  ): boolean {
    if (!donation.processedAt) return false;

    const daysSinceLastProcess =
      (now - donation.processedAt) / (24 * 60 * 60 * 1000);

    switch (donation.recurringInterval) {
      case "monthly":
        return daysSinceLastProcess >= 30;
      case "quarterly":
        return daysSinceLastProcess >= 90;
      case "yearly":
        return daysSinceLastProcess >= 365;
      default:
        return false;
    }
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
      budget: project.raisedAmount,
    });

    project.status = "active";
    this.emit("project:implementation:started", project);
  }
}
