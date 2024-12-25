import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { DepartmentService } from "./department.service";
import { DistrictService } from "./district.service";
import { EventBus } from "./event-bus.service";
import { SocialDynamicsService } from "./social-dynamics.service";
import { DONATION_GOALS, DonationGoal } from "../types/donation-goals";
import { AgentCollaborationService } from "./agent-collaboration.service";

interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  departmentId: string;
  districtId: string;
  amount: number;
  purpose: string;
  category:
    | "general"
    | "religious"
    | "cultural"
    | "educational"
    | "infrastructure"
    | "environmental";
  subcategory?: {
    religious?: {
      religion: string;
      occasion?: string;
      ritual?: string;
      community: string;
    };
    cultural?: {
      tradition: string;
      festival?: string;
      artForm?: string;
      community: string;
    };
  };
  timestamp: number;
  status: "pending" | "completed" | "announced";
  impact: {
    category: string;
    description: string;
    beneficiaries: number;
    completionDate?: number;
    culturalValue?: number;
    communityEngagement?: number;
    traditionPreservation?: number;
  };
  communityParticipation?: {
    volunteers: number;
    events: string[];
    activities: string[];
  };
  challengeId?: string;
  specialRecognition?: {
    badge: string;
    title: string;
    achievementDate: number;
    story?: string;
  };
  culturalSignificance?: {
    historicalContext: string;
    culturalSymbols: string[];
    traditionLinks: string[];
    communityStories: string[];
  };
  interactiveElements?: {
    virtualTour?: string;
    photoGallery?: string[];
    communityMessages: string[];
    participationOptions: string[];
  };
}

interface DonationAnnouncement {
  id: string;
  donationId: string;
  message: string;
  impactDescription: string;
  timestamp: number;
  districtReactions: {
    gratitude: number;
    excitement: number;
    inspiration: number;
  };
}

interface DonationImpact {
  infrastructureImprovement: number;
  communityWellbeing: number;
  culturalEnhancement: number;
  educationalProgress: number;
  environmentalBenefit: number;
}

interface DonationChallenge {
  id: string;
  title: string;
  description: string;
  category: Donation["category"];
  targetAmount: number;
  currentAmount: number;
  startDate: number;
  endDate: number;
  participants: string[];
  rewards: {
    badge: string;
    title: string;
    perks: string[];
  };
  milestones: {
    amount: number;
    reward: string;
    achieved: boolean;
  }[];
  communityGoal: {
    description: string;
    progress: number;
    target: number;
  };
}

interface CulturalMilestone {
  id: string;
  title: string;
  description: string;
  category: "religious" | "cultural";
  achievedDate: number;
  participants: string[];
  impact: {
    culturalValue: number;
    communityEngagement: number;
    traditionPreservation: number;
  };
  celebration: {
    event: string;
    date: number;
    activities: string[];
    specialGuests?: string[];
  };
}

export class DonationService extends EventEmitter {
  private donations: Map<string, Donation> = new Map();
  private announcements: Map<string, DonationAnnouncement> = new Map();
  private donationImpacts: Map<string, DonationImpact> = new Map();
  private readonly eventBus: EventBus;
  private challenges: Map<string, DonationChallenge> = new Map();
  private culturalMilestones: Map<string, CulturalMilestone> = new Map();
  private donationGoals: DonationGoal[] = [...DONATION_GOALS];

  constructor(
    private vectorStore: VectorStoreService,
    private departmentService: DepartmentService,
    private districtService: DistrictService,
    private socialDynamicsService: SocialDynamicsService,
    private collaborationService: AgentCollaborationService
  ) {
    super();
    this.eventBus = EventBus.getInstance();
    this.initializeImpactTracking();
  }

  async processDonation(
    donationData: Omit<Donation, "id" | "status" | "timestamp">
  ): Promise<string> {
    const donationId = crypto.randomUUID();
    const donation: Donation = {
      id: donationId,
      ...donationData,
      status: "pending",
      timestamp: Date.now(),
    };

    // Update department budget through event bus
    this.eventBus.emit("departmentBudgetUpdate", {
      departmentId: donation.departmentId,
      type: "donation",
      amount: donation.amount,
      source: donation.donorId,
      timestamp: donation.timestamp,
    });

    // Store donation
    this.donations.set(donationId, donation);

    // Create impact assessment
    const impact = await this.assessDonationImpact(donation);
    this.donationImpacts.set(donationId, impact);

    // Update donation goals and check for celebrations
    await this.updateDonationGoals(donation);

    // Emit event for tracking
    this.eventBus.emit("donationProcessed", {
      donationId,
      amount: donation.amount,
      department: donation.departmentId,
      district: donation.districtId,
      timestamp: donation.timestamp,
    });

    // Emit event for agent reactions
    this.emit("donationProcessed", {
      donation: {
        donorName: donation.donorName,
        amount: donation.amount,
        purpose: donation.purpose,
        districtId: donation.districtId,
      },
    });

    // Create and store announcement
    await this.createDonationAnnouncement(donation);

    return donationId;
  }

  private async updateDonationGoals(donation: Donation) {
    // Find relevant goals for this department
    const departmentGoals = this.donationGoals.filter(
      (goal) => goal.departmentId === donation.departmentId
    );

    for (const goal of departmentGoals) {
      // Update current amount
      goal.currentAmount += donation.amount;

      // Check if goal is reached
      if (
        goal.currentAmount >= goal.targetAmount &&
        goal.currentAmount - donation.amount < goal.targetAmount
      ) {
        // Goal just reached! Create celebration event
        const celebrationEvent = {
          id: `celebration-${goal.id}-${Date.now()}`,
          title: goal.celebrationEvent.title,
          description: goal.celebrationEvent.description,
          category: goal.celebrationEvent.category,
          severity: 0.3,
          urgency: 0.3,
          duration: goal.celebrationEvent.duration,
          impact: goal.celebrationEvent.impact,
          affectedDistricts: [donation.districtId],
          requiredAgents: [],
          timestamp: Date.now(),
          status: "pending" as const,
        };

        // Emit celebration event
        this.emit("donationGoalReached", {
          goal,
          donation,
          celebrationEvent,
        });

        // Trigger collaboration for celebration planning
        await this.collaborationService.initiateCollaboration(celebrationEvent);

        // Reset the goal for the next milestone
        goal.currentAmount = 0;
      }
    }
  }

  getDonationGoals(): DonationGoal[] {
    return this.donationGoals;
  }

  getDonationGoalProgress(
    goalId: string
  ): { current: number; target: number } | null {
    const goal = this.donationGoals.find((g) => g.id === goalId);
    if (!goal) return null;
    return {
      current: goal.currentAmount,
      target: goal.targetAmount,
    };
  }

  async createDonationAnnouncement(donation: Donation): Promise<void> {
    const impact = this.donationImpacts.get(donation.id);
    const announcement: DonationAnnouncement = {
      id: crypto.randomUUID(),
      donationId: donation.id,
      message: await this.generateAnnouncementMessage(donation),
      impactDescription: await this.generateImpactDescription(donation, impact),
      timestamp: Date.now(),
      districtReactions: {
        gratitude: 0,
        excitement: 0,
        inspiration: 0,
      },
    };

    this.announcements.set(announcement.id, announcement);

    // Announce in district chat
    await this.announceInDistrict(donation.districtId, announcement);

    // Update donation status
    donation.status = "announced";
    this.donations.set(donation.id, donation);
  }

  async getDonationsByDistrict(districtId: string): Promise<Donation[]> {
    return Array.from(this.donations.values())
      .filter((d) => d.districtId === districtId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getDonationsByDepartment(departmentId: string): Promise<Donation[]> {
    return Array.from(this.donations.values())
      .filter((d) => d.departmentId === departmentId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getDistrictAnnouncements(
    districtId: string
  ): Promise<DonationAnnouncement[]> {
    const districtDonations = await this.getDonationsByDistrict(districtId);
    return Array.from(this.announcements.values())
      .filter((a) => districtDonations.some((d) => d.id === a.donationId))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async addReactionToAnnouncement(
    announcementId: string,
    reaction: keyof DonationAnnouncement["districtReactions"]
  ): Promise<void> {
    const announcement = this.announcements.get(announcementId);
    if (announcement) {
      announcement.districtReactions[reaction]++;
      this.announcements.set(announcementId, announcement);

      // Get the donation to find the district
      const donation = this.donations.get(announcement.donationId);
      if (donation) {
        // Broadcast the reaction update
        this.eventBus.emit("donationReaction", {
          districtId: donation.districtId,
          announcementId: announcement.id,
          reaction,
          count: announcement.districtReactions[reaction],
          timestamp: Date.now(),
        });

        // Update social dynamics
        this.eventBus.emit("communityMoodUpdate", {
          districtId: donation.districtId,
          event: "donation_reaction",
          sentiment:
            reaction === "gratitude"
              ? 0.9
              : reaction === "excitement"
              ? 0.8
              : 0.7,
          intensity: 0.5,
        });
      }
    }
  }

  async getDonationImpact(
    donationId: string
  ): Promise<DonationImpact | undefined> {
    return this.donationImpacts.get(donationId);
  }

  private async assessDonationImpact(
    donation: Donation
  ): Promise<DonationImpact> {
    // Calculate impact scores based on donation amount, purpose, and category
    const baseImpact = donation.amount / 1000; // Scale factor
    let multipliers = {
      infrastructure: this.getImpactMultiplier(
        "infrastructure",
        donation.purpose
      ),
      community: this.getImpactMultiplier("community", donation.purpose),
      cultural: this.getImpactMultiplier("cultural", donation.purpose),
      education: this.getImpactMultiplier("education", donation.purpose),
      environment: this.getImpactMultiplier("environment", donation.purpose),
    };

    // Apply category-specific boosts
    if (donation.category === "religious" || donation.category === "cultural") {
      multipliers.cultural *= 1.5;
      multipliers.community *= 1.3;
    }

    // Apply subcategory boosts
    if (donation.subcategory?.religious) {
      if (donation.subcategory.religious.occasion) multipliers.cultural *= 1.2;
      if (donation.subcategory.religious.ritual) multipliers.cultural *= 1.1;
    }
    if (donation.subcategory?.cultural) {
      if (donation.subcategory.cultural.festival) multipliers.cultural *= 1.2;
      if (donation.subcategory.cultural.artForm) multipliers.cultural *= 1.15;
    }

    return {
      infrastructureImprovement: baseImpact * multipliers.infrastructure,
      communityWellbeing: baseImpact * multipliers.community,
      culturalEnhancement: baseImpact * multipliers.cultural,
      educationalProgress: baseImpact * multipliers.education,
      environmentalBenefit: baseImpact * multipliers.environment,
    };
  }

  private getImpactMultiplier(category: string, purpose: string): number {
    const purposeLower = purpose.toLowerCase();
    switch (category) {
      case "infrastructure":
        return purposeLower.includes("infrastructure") ||
          purposeLower.includes("building")
          ? 1.5
          : 0.8;
      case "community":
        return purposeLower.includes("community") ||
          purposeLower.includes("social")
          ? 1.4
          : 0.7;
      case "cultural":
        return purposeLower.includes("culture") || purposeLower.includes("art")
          ? 1.3
          : 0.6;
      case "education":
        return purposeLower.includes("education") ||
          purposeLower.includes("learning")
          ? 1.6
          : 0.9;
      case "environment":
        return purposeLower.includes("environment") ||
          purposeLower.includes("green")
          ? 1.4
          : 0.8;
      default:
        return 1.0;
    }
  }

  private async generateAnnouncementMessage(
    donation: Donation
  ): Promise<string> {
    const department = await this.departmentService.getDepartment(
      donation.departmentId
    );
    let message = `🎉 Exciting news! ${
      donation.donorName
    } has made a generous donation of $${donation.amount.toLocaleString()} `;

    // Add category-specific messages
    switch (donation.category) {
      case "religious":
        const religious = donation.subcategory?.religious;
        message += `to support our ${religious?.religion} community${
          religious?.occasion ? ` for ${religious.occasion}` : ""
        }! `;
        if (religious?.ritual) {
          message += `This will help preserve our sacred ${religious.ritual} traditions. `;
        }
        break;
      case "cultural":
        const cultural = donation.subcategory?.cultural;
        message += `to celebrate our cultural heritage${
          cultural?.festival ? ` during ${cultural.festival}` : ""
        }! `;
        if (cultural?.artForm) {
          message += `This will help preserve and promote ${cultural.artForm}. `;
        }
        break;
      default:
        message += `to support ${department?.name}'s initiatives in our district! `;
    }

    message += `This contribution will help ${donation.purpose}. `;

    // Add community participation details
    if (donation.communityParticipation) {
      message += `\n\n👥 Join ${donation.communityParticipation.volunteers} community members in upcoming `;
      message += `${donation.communityParticipation.events.join(", ")}! `;
      if (donation.communityParticipation.activities.length > 0) {
        message += `\nActivities include: ${donation.communityParticipation.activities.join(
          ", "
        )}`;
      }
    }

    message += `\n\nThank you for making our city better! 🌟`;
    return message;
  }

  private async generateImpactDescription(
    donation: Donation,
    impact?: DonationImpact
  ): Promise<string> {
    if (!impact) return "";

    const highestImpact = Object.entries(impact).reduce((a, b) =>
      a[1] > b[1] ? a : b
    );

    const impactDescriptions = {
      infrastructureImprovement: "improving our city's infrastructure",
      communityWellbeing: "enhancing community wellbeing",
      culturalEnhancement: "enriching our cultural landscape",
      educationalProgress: "advancing educational opportunities",
      environmentalBenefit: "supporting environmental initiatives",
    };

    let description = `This donation will have the greatest impact in ${
      impactDescriptions[highestImpact[0] as keyof typeof impactDescriptions]
    }. `;
    description += `The benefits will reach approximately ${Math.floor(
      donation.amount / 100
    )} community members. 🌱\n\n`;

    // Add category-specific impact details
    if (donation.category === "religious" || donation.category === "cultural") {
      description += "Cultural Impact:\n";
      description += `• Tradition Preservation: ${Math.round(
        impact.culturalEnhancement * 120
      )}%\n`;
      description += `• Community Engagement: ${Math.round(
        impact.communityWellbeing * 110
      )}%\n`;

      if (donation.category === "religious") {
        const religious = donation.subcategory?.religious;
        description += `• Supporting ${
          religious?.community || "religious"
        } community activities\n`;
      } else {
        const cultural = donation.subcategory?.cultural;
        description += `• Promoting ${
          cultural?.tradition || "cultural"
        } traditions\n`;
      }
    }

    return description;
  }

  private async announceInDistrict(
    districtId: string,
    announcement: DonationAnnouncement
  ): Promise<void> {
    // Emit event for district chat
    this.eventBus.emit("districtAnnouncement", {
      districtId,
      type: "donation",
      content: `${announcement.message}\n\n${announcement.impactDescription}`,
      timestamp: announcement.timestamp,
    });

    // Update social dynamics through event bus
    this.eventBus.emit("communityMoodUpdate", {
      districtId,
      event: "donation",
      sentiment: 0.8,
      intensity: Math.min(
        1,
        Math.log10(this.donations.get(announcement.donationId)?.amount || 0) / 5
      ),
    });
  }

  private initializeImpactTracking(): void {
    setInterval(() => this.updateDonationImpacts(), 60 * 60 * 1000); // Every hour
  }

  private async updateDonationImpacts(): Promise<void> {
    for (const [donationId, donation] of this.donations.entries()) {
      if (donation.status === "completed") continue;

      const impact = this.donationImpacts.get(donationId);
      if (impact) {
        // Update completion status if benefits have been realized
        const timeSinceDonation = Date.now() - donation.timestamp;
        if (timeSinceDonation > 7 * 24 * 60 * 60 * 1000) {
          // 7 days
          donation.status = "completed";
          donation.impact.completionDate = Date.now();
          this.donations.set(donationId, donation);

          // Announce completion
          await this.announceCompletion(donation, impact);
        }
      }
    }
  }

  private async announceCompletion(
    donation: Donation,
    impact: DonationImpact
  ): Promise<void> {
    const completionMessage =
      `🎯 Impact Update: The donation from ${donation.donorName} has been fully utilized! Here's what we achieved:\n\n` +
      `• Infrastructure: ${Math.round(
        impact.infrastructureImprovement * 100
      )}% improvement\n` +
      `• Community: ${Math.round(
        impact.communityWellbeing * 100
      )}% enhancement\n` +
      `• Culture: ${Math.round(
        impact.culturalEnhancement * 100
      )}% enrichment\n` +
      `• Education: ${Math.round(
        impact.educationalProgress * 100
      )}% advancement\n` +
      `• Environment: ${Math.round(
        impact.environmentalBenefit * 100
      )}% benefit\n\n` +
      `Thank you for making our district better! 🌟`;

    this.eventBus.emit("districtAnnouncement", {
      districtId: donation.districtId,
      type: "donation_completion",
      content: completionMessage,
      timestamp: Date.now(),
    });
  }

  async suggestCommunityActivities(donation: Donation): Promise<string[]> {
    const activities: string[] = [];

    if (donation.category === "religious") {
      const religious = donation.subcategory?.religious;
      activities.push(
        `${religious?.religion || "Religious"} community gathering`,
        `Traditional ceremony participation`,
        `Youth education programs`,
        `Community feast organization`
      );
      if (religious?.ritual) {
        activities.push(
          `${religious.ritual} preparation`,
          `Sacred space maintenance`
        );
      }
    } else if (donation.category === "cultural") {
      const cultural = donation.subcategory?.cultural;
      activities.push(
        `Cultural workshop organization`,
        `Traditional art exhibitions`,
        `Community performance events`
      );
      if (cultural?.artForm) {
        activities.push(
          `${cultural.artForm} workshops`,
          `Youth training programs`
        );
      }
      if (cultural?.festival) {
        activities.push(
          `${cultural.festival} preparation`,
          `Festival coordination`
        );
      }
    }

    return activities;
  }

  async getUpcomingCulturalEvents(districtId: string): Promise<{
    religious: string[];
    cultural: string[];
  }> {
    const districtDonations = await this.getDonationsByDistrict(districtId);
    const events = {
      religious: new Set<string>(),
      cultural: new Set<string>(),
    };

    districtDonations
      .filter(
        (d) =>
          d.status !== "completed" &&
          (d.category === "religious" || d.category === "cultural")
      )
      .forEach((d) => {
        if (d.category === "religious" && d.subcategory?.religious?.occasion) {
          events.religious.add(d.subcategory.religious.occasion);
        } else if (
          d.category === "cultural" &&
          d.subcategory?.cultural?.festival
        ) {
          events.cultural.add(d.subcategory.cultural.festival);
        }
      });

    return {
      religious: Array.from(events.religious),
      cultural: Array.from(events.cultural),
    };
  }

  async createDonationChallenge(
    challenge: Omit<DonationChallenge, "id" | "currentAmount" | "participants">
  ): Promise<string> {
    const id = crypto.randomUUID();
    const newChallenge: DonationChallenge = {
      id,
      ...challenge,
      currentAmount: 0,
      participants: [],
    };
    this.challenges.set(id, newChallenge);

    // Announce challenge
    this.eventBus.emit("districtAnnouncement", {
      districtId: "all",
      type: "challenge_created",
      content: this.generateChallengeAnnouncement(newChallenge),
      timestamp: Date.now(),
    });

    return id;
  }

  async participateInChallenge(
    donationId: string,
    challengeId: string
  ): Promise<void> {
    const donation = this.donations.get(donationId);
    const challenge = this.challenges.get(challengeId);

    if (!donation || !challenge) return;

    // Update challenge
    challenge.currentAmount += donation.amount;
    challenge.participants.push(donation.donorId);

    // Check milestones
    challenge.milestones.forEach((milestone) => {
      if (!milestone.achieved && challenge.currentAmount >= milestone.amount) {
        milestone.achieved = true;
        this.announceMilestoneAchievement(challenge, milestone);
      }
    });

    // Check if challenge completed
    if (challenge.currentAmount >= challenge.targetAmount) {
      await this.completeDonationChallenge(challenge);
    }

    this.challenges.set(challengeId, challenge);
  }

  async createCulturalMilestone(
    milestone: Omit<CulturalMilestone, "id" | "achievedDate">
  ): Promise<string> {
    const id = crypto.randomUUID();
    const newMilestone: CulturalMilestone = {
      id,
      ...milestone,
      achievedDate: Date.now(),
    };
    this.culturalMilestones.set(id, newMilestone);

    // Announce milestone
    await this.announceCulturalMilestone(newMilestone);
    return id;
  }

  async addCommunityStory(donationId: string, story: string): Promise<void> {
    const donation = this.donations.get(donationId);
    if (!donation) return;

    if (!donation.culturalSignificance) {
      donation.culturalSignificance = {
        historicalContext: "",
        culturalSymbols: [],
        traditionLinks: [],
        communityStories: [],
      };
    }

    donation.culturalSignificance.communityStories.push(story);
    this.donations.set(donationId, donation);

    // Announce new story
    this.eventBus.emit("districtAnnouncement", {
      districtId: donation.districtId,
      type: "community_story",
      content: `📖 New Community Story Added!\n\n"${story}"\n\nShare your story about this donation's impact!`,
      timestamp: Date.now(),
    });
  }

  async getActiveChallenges(): Promise<DonationChallenge[]> {
    const now = Date.now();
    return Array.from(this.challenges.values())
      .filter((c) => c.startDate <= now && c.endDate >= now)
      .sort(
        (a, b) =>
          b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount
      );
  }

  async getDonationChallengeProgress(challengeId: string): Promise<{
    challenge: DonationChallenge;
    topDonors: Array<{ donorName: string; amount: number }>;
    recentMilestones: Array<{ description: string; achievedDate: number }>;
    communityImpact: string;
  }> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const donations = Array.from(this.donations.values()).filter(
      (d) => d.challengeId === challengeId
    );

    const topDonors = donations
      .reduce((acc, d) => {
        const existing = acc.find((x) => x.donorName === d.donorName);
        if (existing) {
          existing.amount += d.amount;
        } else {
          acc.push({ donorName: d.donorName, amount: d.amount });
        }
        return acc;
      }, [] as Array<{ donorName: string; amount: number }>)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const recentMilestones = challenge.milestones
      .filter((m) => m.achieved)
      .map((m) => ({
        description: m.reward,
        achievedDate: Date.now(), // In real implementation, store achievement dates
      }));

    return {
      challenge,
      topDonors,
      recentMilestones,
      communityImpact: this.generateCommunityImpactSummary(challenge),
    };
  }

  private generateChallengeAnnouncement(challenge: DonationChallenge): string {
    return (
      `🌟 New Donation Challenge: ${challenge.title} 🌟\n\n` +
      `${challenge.description}\n\n` +
      `🎯 Goal: $${challenge.targetAmount.toLocaleString()}\n` +
      `⏳ Ends: ${new Date(challenge.endDate).toLocaleDateString()}\n\n` +
      `🏆 Rewards:\n` +
      `• ${challenge.rewards.badge} - ${challenge.rewards.title}\n` +
      challenge.rewards.perks.map((perk) => `• ${perk}`).join("\n") +
      "\n\n" +
      `Join us in making a difference! 💫`
    );
  }

  private async completeDonationChallenge(
    challenge: DonationChallenge
  ): Promise<void> {
    const completionMessage =
      `🎉 Amazing Achievement! The ${challenge.title} Challenge is Complete! 🎉\n\n` +
      `Together, we raised $${challenge.currentAmount.toLocaleString()} ` +
      `with ${challenge.participants.length} generous donors!\n\n` +
      `🌟 Community Impact:\n${this.generateCommunityImpactSummary(
        challenge
      )}\n\n` +
      `Thank you to all participants! Your badges and rewards are on the way! 🏆`;

    this.eventBus.emit("districtAnnouncement", {
      districtId: "all",
      type: "challenge_completed",
      content: completionMessage,
      timestamp: Date.now(),
    });
  }

  private generateCommunityImpactSummary(challenge: DonationChallenge): string {
    const progress =
      (challenge.communityGoal.progress / challenge.communityGoal.target) * 100;
    return (
      `${challenge.communityGoal.description}\n` +
      `Progress: ${Math.round(progress)}% complete\n` +
      `Impact: ${this.generateImpactMetric(challenge.currentAmount)}`
    );
  }

  private generateImpactMetric(amount: number): string {
    const metrics = [
      { threshold: 1000, message: "Supporting local community initiatives" },
      { threshold: 5000, message: "Enabling cultural preservation projects" },
      { threshold: 10000, message: "Transforming community spaces" },
      { threshold: 50000, message: "Creating lasting cultural legacy" },
      { threshold: 100000, message: "Revolutionizing community development" },
    ];

    const applicable = metrics
      .filter((m) => amount >= m.threshold)
      .map((m) => m.message)
      .join(" • ");

    return applicable || "Every contribution makes a difference";
  }

  private async announceMilestoneAchievement(
    challenge: DonationChallenge,
    milestone: { amount: number; reward: string }
  ): Promise<void> {
    const message =
      `🎯 Milestone Achieved in ${challenge.title}!\n\n` +
      `We've reached $${milestone.amount.toLocaleString()}!\n` +
      `🎁 Reward Unlocked: ${milestone.reward}\n\n` +
      `Keep the momentum going! Next milestone: $${
        this.getNextMilestone(
          challenge,
          milestone.amount
        )?.amount.toLocaleString() || "Final Goal"
      }`;

    this.eventBus.emit("districtAnnouncement", {
      districtId: "all",
      type: "milestone_achieved",
      content: message,
      timestamp: Date.now(),
    });
  }

  private getNextMilestone(
    challenge: DonationChallenge,
    currentAmount: number
  ): { amount: number; reward: string } | undefined {
    return challenge.milestones
      .filter((m) => m.amount > currentAmount)
      .sort((a, b) => a.amount - b.amount)[0];
  }

  private async announceCulturalMilestone(
    milestone: CulturalMilestone
  ): Promise<void> {
    const message =
      `🎊 Cultural Milestone Achieved: ${milestone.title} 🎊\n\n` +
      `${milestone.description}\n\n` +
      `🌟 Impact Metrics:\n` +
      `• Cultural Value: ${Math.round(
        milestone.impact.culturalValue * 100
      )}%\n` +
      `• Community Engagement: ${Math.round(
        milestone.impact.communityEngagement * 100
      )}%\n` +
      `• Tradition Preservation: ${Math.round(
        milestone.impact.traditionPreservation * 100
      )}%\n\n` +
      `🎉 Celebration Event:\n` +
      `${milestone.celebration.event}\n` +
      `📅 ${new Date(milestone.celebration.date).toLocaleDateString()}\n` +
      `Activities: ${milestone.celebration.activities.join(", ")}\n` +
      (milestone.celebration.specialGuests
        ? `Special Guests: ${milestone.celebration.specialGuests.join(", ")}\n`
        : "") +
      `\nJoin us in celebrating this achievement! 🌟`;

    this.eventBus.emit("districtAnnouncement", {
      districtId: "all",
      type: "cultural_milestone",
      content: message,
      timestamp: Date.now(),
    });
  }
}
