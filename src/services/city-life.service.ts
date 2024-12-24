import { EventEmitter } from "events";
import { Agent } from "../types/agent.types";
import {
  CityEvent,
  CityEventCategory,
  CulturalEvent,
  DevelopmentProposal,
  EmergencyEvent,
  SocialEvent,
  TransportEvent,
} from "../types/city-events";
import {
  AgentConversationService,
  TransportService,
  CultureService,
  DevelopmentService,
  SocialDynamicsService,
  CityCoordinatorService,
  WebSocketService,
} from "../types/services.types";
import { DonationService } from "./donation.service";
import { DepartmentService } from "./department.service";
import { AgentCollaborationService } from "./agent-collaboration.service";

interface CityLifeEvent {
  type:
    | "movement"
    | "conversation"
    | "reaction"
    | "development"
    | "emergency"
    | "cultural"
    | "social";
  agentId?: string;
  districtId?: string;
  data: any;
  timestamp: number;
}

interface DistrictActivity {
  districtId: string;
  activeAgents: string[];
  currentConversations: Array<{
    agents: string[];
    topic: string;
    startTime: number;
  }>;
  culturalEvents: CulturalEvent[];
  developmentProjects: DevelopmentProposal[];
  emergencies: EmergencyEvent[];
}

export class CityLifeService extends EventEmitter {
  private cityEvents: CityLifeEvent[] = [];
  private agentLocations: Map<string, string> = new Map(); // agentId -> districtId
  private activeConversations: Map<string, Set<string>> = new Map(); // districtId -> Set<agentId>
  private districtActivities: Map<string, DistrictActivity> = new Map();
  private lastUpdateTime: number = Date.now();
  private eventEmitter: EventEmitter;

  constructor(
    private agentConversationService: AgentConversationService,
    private transportService: TransportService,
    private cultureService: CultureService,
    private developmentService: DevelopmentService,
    private donationService: DonationService,
    private cityCoordinator: CityCoordinatorService,
    private socialDynamicsService: SocialDynamicsService,
    private departmentService: DepartmentService,
    private wsService: WebSocketService,
    private agentCollaborationService: AgentCollaborationService
  ) {
    super();
    this.eventEmitter = new EventEmitter();
    this.initializeService();
  }

  private async initializeService() {
    // Set up event listeners
    this.setupEventListeners();

    // Initialize district activities
    await this.initializeDistrictActivities();

    // Start city life cycle
    setInterval(() => this.updateCityLife(), 30 * 1000); // Update every 30 seconds
    setInterval(() => this.updateDistrictActivities(), 60 * 1000); // Update district activities every minute
    setInterval(() => this.broadcastCityStatus(), 10 * 1000); // Broadcast status every 10 seconds
    setInterval(() => this.cleanupOldEvents(), 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  private async initializeDistrictActivities() {
    const districts = await this.cityCoordinator.getActiveDistricts();
    for (const district of districts) {
      this.districtActivities.set(district.id, {
        districtId: district.id,
        activeAgents: [],
        currentConversations: [],
        culturalEvents: [],
        developmentProjects: [],
        emergencies: [],
      });
    }
  }

  private setupEventListeners() {
    // Listen for donations
    this.donationService.on("donation", async (donation) => {
      const districtId = donation.districtId;
      const nearbyAgents = this.getAgentsInDistrict(districtId);

      // Have agents react to donation and possibly collaborate
      const collaborationSession =
        await this.agentCollaborationService.initiateCollaboration({
          id: `donation-${Date.now()}`,
          title: "Donation Response",
          description: `Responding to donation in district ${districtId}`,
          category: "community",
          severity: 0.5,
          urgency: 0.6,
          duration: 24 * 60 * 60 * 1000, // 24 hours
          requiredAgents: Array.from(nearbyAgents),
          affectedDistricts: [districtId],
          impact: {
            social: 0.8,
            economic: 0.6,
            environmental: 0.4,
          },
        });

      this.emitCityEvent({
        type: "reaction",
        districtId,
        data: { donation, reactions: nearbyAgents.size, collaborationSession },
        timestamp: Date.now(),
      });
    });

    // Listen for emergencies
    this.departmentService.on(
      "emergency",
      async (emergency: EmergencyEvent) => {
        const districtId = emergency.districtId;
        const nearbyAgents = this.getAgentsInDistrict(districtId);
        const activity = this.districtActivities.get(districtId);

        if (activity) {
          activity.emergencies.push(emergency);
        }

        // Initiate emergency collaboration
        const collaborationSession =
          await this.agentCollaborationService.initiateCollaboration({
            id: `emergency-${Date.now()}`,
            title: "Emergency Response",
            description: emergency.description,
            category: "emergency",
            severity: emergency.severity,
            urgency: 0.9,
            duration: 48 * 60 * 60 * 1000, // 48 hours
            requiredAgents: Array.from(nearbyAgents),
            affectedDistricts: [districtId],
            impact: {
              social: 0.9,
              economic: 0.7,
              environmental: 0.8,
            },
          });

        this.emitCityEvent({
          type: "emergency",
          districtId,
          data: {
            emergency,
            responders: nearbyAgents.size,
            collaborationSession,
          },
          timestamp: Date.now(),
        });
      }
    );

    // Subscribe to cultural events
    this.eventEmitter.on("culturalEvent", async (event: CulturalEvent) => {
      const districtId = event.districtId;
      const activity = this.districtActivities.get(districtId);

      if (activity) {
        activity.culturalEvents.push(event);
      }

      const nearbyAgents = this.getAgentsInDistrict(districtId);
      await this.initiateGroupDiscussion(
        Array.from(nearbyAgents),
        "cultural",
        event
      );

      this.emitCityEvent({
        type: "cultural",
        districtId,
        data: event,
        timestamp: Date.now(),
      });
    });

    // Subscribe to development updates
    this.eventEmitter.on(
      "development",
      async (development: DevelopmentProposal) => {
        const districtId = development.districtId;
        const activity = this.districtActivities.get(districtId);

        if (activity) {
          activity.developmentProjects.push(development);
        }

        const nearbyAgents = this.getAgentsInDistrict(districtId);
        await this.initiateGroupDiscussion(
          Array.from(nearbyAgents),
          "development",
          development
        );

        this.emitCityEvent({
          type: "development",
          districtId,
          data: development,
          timestamp: Date.now(),
        });
      }
    );

    // Subscribe to social dynamics changes
    this.eventEmitter.on("socialChange", async (change: SocialEvent) => {
      const districtId = change.districtId;
      const nearbyAgents = this.getAgentsInDistrict(districtId);
      await this.initiateGroupDiscussion(
        Array.from(nearbyAgents),
        "social",
        change
      );

      this.emitCityEvent({
        type: "social",
        districtId,
        data: change,
        timestamp: Date.now(),
      });
    });
  }

  private async updateCityLife() {
    const districts = await this.cityCoordinator.getActiveDistricts();
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastUpdateTime;

    // Update each district
    for (const district of districts) {
      const agentsInDistrict = this.getAgentsInDistrict(district.id);
      const activity = this.districtActivities.get(district.id);

      if (activity) {
        activity.activeAgents = Array.from(agentsInDistrict);
      }

      // Randomly move some agents to other districts based on time passed
      for (const agentId of agentsInDistrict) {
        const moveChance = Math.min(0.3, (timeDiff / (3600 * 1000)) * 0.1); // Higher chance the more time passed
        if (Math.random() < moveChance) {
          const targetDistrict = await this.selectTargetDistrict(
            districts,
            district.id,
            agentId
          );
          await this.moveAgent(agentId, targetDistrict.id);
        }
      }

      // Start conversations between agents in the same district
      await this.initiateDistrictConversations(district.id);

      // Update district development
      await this.updateDistrictDevelopment(district.id);
    }

    this.lastUpdateTime = currentTime;
  }

  private async selectTargetDistrict(
    districts: any[],
    currentDistrictId: string,
    agentId: string
  ) {
    // Get agent's preferences and interests
    const agentInterests =
      await this.agentConversationService.getAgentInterests(agentId);

    // Score each district based on agent's interests and current activities
    const scoredDistricts = await Promise.all(
      districts
        .filter((d) => d.id !== currentDistrictId)
        .map(async (district) => {
          const activity = this.districtActivities.get(district.id);
          const culturalScore =
            await this.cultureService.getDistrictCultureScore(
              district.id,
              agentInterests
            );
          const socialScore =
            await this.socialDynamicsService.getDistrictSocialScore(
              district.id
            );
          const developmentScore = activity
            ? activity.developmentProjects.length * 0.1
            : 0;

          return {
            district,
            score:
              culturalScore * 0.4 +
              socialScore * 0.3 +
              developmentScore * 0.3 +
              Math.random() * 0.2,
          };
        })
    );

    // Return the district with the highest score
    return scoredDistricts.reduce((best, current) =>
      current.score > best.score ? current : best
    ).district;
  }

  private async moveAgent(agentId: string, targetDistrictId: string) {
    const currentDistrictId = this.agentLocations.get(agentId);
    if (currentDistrictId === targetDistrictId) return;

    // Use transport service to move agent
    const transportResult = await this.transportService.transportAgent(
      agentId,
      currentDistrictId,
      targetDistrictId
    );

    if (transportResult.success) {
      // Update agent location
      this.agentLocations.set(agentId, targetDistrictId);

      // Update district activities
      const currentActivity = this.districtActivities.get(currentDistrictId!);
      const targetActivity = this.districtActivities.get(targetDistrictId);

      if (currentActivity) {
        currentActivity.activeAgents = currentActivity.activeAgents.filter(
          (id) => id !== agentId
        );
      }
      if (targetActivity) {
        targetActivity.activeAgents.push(agentId);
      }

      this.emitCityEvent({
        type: "movement",
        agentId,
        districtId: targetDistrictId,
        data: {
          from: currentDistrictId,
          to: targetDistrictId,
          transport: transportResult.method,
          duration: transportResult.duration,
        },
        timestamp: Date.now(),
      });
    }
  }

  private async initiateDistrictConversations(districtId: string) {
    const agents = Array.from(this.getAgentsInDistrict(districtId));
    if (agents.length < 2) return;

    const activity = this.districtActivities.get(districtId);
    if (!activity) return;

    // Get district context
    const [districtContext, culturalContext, socialContext] = await Promise.all(
      [
        this.cityCoordinator.getDistrictContext(districtId),
        this.cultureService.getDistrictCulture(districtId),
        this.socialDynamicsService.getDistrictDynamics(districtId),
      ]
    );

    // Create conversation groups based on interests and current activities
    const groups = await this.createConversationGroups(agents, districtId);

    // Start conversations for each group
    for (const group of groups) {
      const conversation =
        await this.agentConversationService.initiateConversation(group, {
          districtId,
          districtContext,
          culturalContext,
          socialContext,
          currentEvents: {
            cultural: activity.culturalEvents,
            development: activity.developmentProjects,
            emergencies: activity.emergencies,
          },
        });

      if (conversation) {
        activity.currentConversations.push({
          agents: group,
          topic: conversation.topic,
          startTime: Date.now(),
        });

        this.emitCityEvent({
          type: "conversation",
          districtId,
          data: {
            agents: group,
            topic: conversation.topic,
            context: conversation.context,
          },
          timestamp: Date.now(),
        });
      }
    }
  }

  private async createConversationGroups(
    agents: string[],
    districtId: string
  ): Promise<string[][]> {
    const groups: string[][] = [];
    const ungroupedAgents = [...agents];

    while (ungroupedAgents.length >= 2) {
      const agent1 = ungroupedAgents.shift()!;

      // Find the most compatible agent for conversation
      const [bestMatch] = await Promise.all(
        ungroupedAgents.map(async (agent2) => ({
          agent: agent2,
          compatibility:
            await this.socialDynamicsService.calculateAgentCompatibility(
              agent1,
              agent2
            ),
        }))
      ).then((matches) =>
        matches.sort((a, b) => b.compatibility - a.compatibility)
      );

      if (bestMatch) {
        const agent2Index = ungroupedAgents.indexOf(bestMatch.agent);
        ungroupedAgents.splice(agent2Index, 1);
        groups.push([agent1, bestMatch.agent]);
      }
    }

    return groups;
  }

  private async initiateGroupDiscussion(
    agents: string[],
    topic: string,
    context: any
  ) {
    if (agents.length < 2) return;

    const conversation =
      await this.agentConversationService.initiateConversation(agents, {
        topic,
        context,
        groupDiscussion: true,
      });

    if (conversation) {
      this.emitCityEvent({
        type: "conversation",
        data: {
          agents,
          topic,
          context: conversation.context,
        },
        timestamp: Date.now(),
      });
    }
  }

  private async updateDistrictDevelopment(districtId: string) {
    const activity = this.districtActivities.get(districtId);
    if (!activity) return;

    // Get development proposals from agents
    const proposals = await Promise.all(
      activity.activeAgents.map((agentId) =>
        this.agentConversationService.getAgentDevelopmentProposal(
          agentId,
          districtId
        )
      )
    );

    // Filter valid proposals
    const validProposals = proposals.filter(
      (p): p is DevelopmentProposal => p !== null && p.impact > 0.5
    );

    if (validProposals.length > 0) {
      // Initiate collaboration for development
      await this.agentCollaborationService.initiateCollaboration({
        id: `development-${Date.now()}`,
        title: "District Development Planning",
        description:
          "Evaluating development proposals for district improvement",
        category: "development",
        severity: 0.7,
        urgency: 0.7,
        duration: 7 * 24 * 60 * 60 * 1000, // 7 days
        requiredAgents: activity.activeAgents,
        affectedDistricts: [districtId],
        impact: {
          social: 0.8,
          economic: 0.9,
          environmental: 0.7,
        },
      });
    }
  }

  private getAgentsInDistrict(districtId: string): Set<string> {
    const agents = new Set<string>();
    for (const [agentId, location] of this.agentLocations.entries()) {
      if (location === districtId) {
        agents.add(agentId);
      }
    }
    return agents;
  }

  private async updateDistrictActivities() {
    for (const activity of this.districtActivities.values()) {
      // Clean up old conversations
      activity.currentConversations = activity.currentConversations.filter(
        (conv) => Date.now() - conv.startTime < 30 * 60 * 1000 // Remove conversations older than 30 minutes
      );

      // Clean up old events
      activity.culturalEvents = activity.culturalEvents.filter(
        (event) => Date.now() - event.timestamp < 24 * 60 * 60 * 1000 // Keep events from last 24 hours
      );
      activity.emergencies = activity.emergencies.filter(
        (emergency) => !emergency.resolved
      );
    }
  }

  private async broadcastCityStatus() {
    const status = {
      timestamp: Date.now(),
      districts: await this.cityCoordinator.getActiveDistricts(),
      districtActivities: Array.from(this.districtActivities.entries()).map(
        ([districtId, activity]) => ({
          districtId,
          activeAgents: activity.activeAgents.length,
          conversations: activity.currentConversations.length,
          culturalEvents: activity.culturalEvents.length,
          developmentProjects: activity.developmentProjects.length,
          emergencies: activity.emergencies.length,
        })
      ),
      recentEvents: this.cityEvents.slice(-20),
      cityMood: await this.cultureService.getCityMood(),
      developmentStatus: await this.developmentService.getDevelopmentStatus(),
      socialDynamics: await this.socialDynamicsService.getCitySocialStatus(),
    };

    this.wsService.broadcast("cityStatus", status);
  }

  private cleanupOldEvents() {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.cityEvents = this.cityEvents.filter(
      (event) => event.timestamp > cutoffTime
    );
  }

  private emitCityEvent(event: CityLifeEvent) {
    this.cityEvents.push(event);
    this.emit("cityEvent", event);
    this.wsService.broadcast("cityLife", event);
  }

  // Public methods
  async registerAgent(agent: Agent, initialDistrictId: string) {
    this.agentLocations.set(agent.id, initialDistrictId);
    await this.agentConversationService.registerAgent(agent);

    const activity = this.districtActivities.get(initialDistrictId);
    if (activity) {
      activity.activeAgents.push(agent.id);
    }

    this.emitCityEvent({
      type: "movement",
      agentId: agent.id,
      districtId: initialDistrictId,
      data: { initial: true },
      timestamp: Date.now(),
    });
  }

  async getAgentLocation(agentId: string): Promise<string | undefined> {
    return this.agentLocations.get(agentId);
  }

  async getCityEvents(limit: number = 50): Promise<CityLifeEvent[]> {
    return this.cityEvents.slice(-limit);
  }

  async getDistrictActivity(
    districtId: string
  ): Promise<DistrictActivity | undefined> {
    return this.districtActivities.get(districtId);
  }

  async getAllDistrictActivities(): Promise<Map<string, DistrictActivity>> {
    return new Map(this.districtActivities);
  }
}
