import { TogetherService } from "./together.service";
import { VectorStoreService as VectorService } from "./vector-store.service";

interface CityNews {
  headline: string;
  content: string;
  category:
    | "politics"
    | "culture"
    | "infrastructure"
    | "environment"
    | "technology"
    | "community";
  timestamp: number;
  importance: number;
  relatedDistricts?: string[];
  relatedAgents?: string[];
}

interface CityIncident {
  id: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  location: string;
  timestamp: number;
  involvedAgents?: string[];
  status: "ongoing" | "resolved" | "under_investigation";
  responseTeam?: string[];
  type: "crime" | "accident" | "disturbance" | "emergency" | "infrastructure";
}

interface DepartmentBudget {
  department: string;
  currentBudget: number;
  spent: number;
  allocated: number;
  topExpenses: {
    category: string;
    amount: number;
  }[];
  efficiency: number;
}

interface CityEvent {
  title: string;
  description: string;
  type: "celebration" | "incident" | "development" | "cultural" | "emergency";
  location: string;
  timestamp: number;
  impact: number;
  participants?: string[];
}

interface DetailedMetrics {
  safety: {
    overallSafety: number;
    incidentRate: number;
    emergencyResponseTime: number;
    crimeRate: number;
    publicTrust: number;
  };
  economy: {
    totalBudget: number;
    budgetUtilization: number;
    projectEfficiency: number;
    resourceAllocation: number;
    investmentReturn: number;
  };
  society: {
    cityActivity: number;
    culturalHarmony: number;
    citizenSatisfaction: number;
    communityEngagement: number;
    socialCohesion: number;
  };
  infrastructure: {
    infrastructureStatus: number;
    maintenanceEfficiency: number;
    systemReliability: number;
    modernizationLevel: number;
    capacityUtilization: number;
  };
  environment: {
    environmentalHealth: number;
    sustainabilityIndex: number;
    pollutionLevels: number;
    greenSpaceUtilization: number;
    resourceEfficiency: number;
  };
}

interface DailyChronicle {
  date: string;
  headlines: CityNews[];
  events: CityEvent[];
  incidents: CityIncident[];
  departmentBudgets: DepartmentBudget[];
  metrics: DetailedMetrics;
}

const generateNewsPrompt = (context: string) => `
[AI CITY DAILY NEWS GENERATOR]
Context: ${context}

Generate a news article with the following structure:
- Headline: A catchy, newspaper-style headline
- Content: A detailed news story (2-3 paragraphs)
- Category: One of [politics, culture, infrastructure, environment, technology, community]
- Importance: A number from 1-10 indicating the story's significance

Use journalistic style, focus on facts and details. Make it feel like a real city newspaper.

Article:`;

const generateEventPrompt = (context: string) => `
[AI CITY EVENT GENERATOR]
Context: ${context}

Generate an urban event with the following structure:
- Title: A descriptive event title
- Description: What's happening (2-3 sentences)
- Type: One of [celebration, incident, development, cultural, emergency]
- Location: Specific location in the city
- Impact: A number from 1-10 indicating the event's impact

Make it realistic and fitting for an AI-managed city.

Event:`;

const generateIncidentPrompt = (context: string) => `
[AI CITY INCIDENT REPORT]
Context: ${context}

Generate a city incident report with the following structure:
- Description: A clear, concise description of the incident
- Severity: One of [low, medium, high, critical]
- Location: Specific location in the city
- Type: One of [crime, accident, disturbance, emergency, infrastructure]
- Status: One of [ongoing, resolved, under_investigation]

Keep it factual and precise, like a police or emergency services report.

Incident:`;

export class ChroniclesService {
  private lastUpdate: number = 0;
  private currentChronicle: DailyChronicle | null = null;
  private readonly UPDATE_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  private readonly NEWS_PER_UPDATE = 3;
  private readonly EVENTS_PER_UPDATE = 2;

  constructor(
    private togetherService: TogetherService,
    private vectorService: VectorService
  ) {
    // Initialize chronicles data immediately
    console.log("🗞️ Initializing Chronicles Service...");
    this.initializeChronicles().catch((error) => {
      console.error("Failed to initialize chronicles:", error);
    });
  }

  private async initializeChronicles() {
    // Generate initial context
    const context = `
Initial City Status Report
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Status: City initialization phase
Focus: Setting up initial monitoring and reporting systems
Activities: System calibration and baseline data collection
Conditions: Standard operating parameters
    `.trim();

    // Generate initial data
    const [news, events, incidents] = await Promise.all([
      this.generateDailyNews(context),
      this.generateRandomEvents(context),
      this.generateIncidents(context),
    ]);

    this.currentChronicle = {
      date: new Date().toISOString(),
      headlines: news,
      events,
      incidents,
      departmentBudgets: this.generateDepartmentBudgets(),
      metrics: this.generateRandomMetrics(),
    };

    // Store initial data in vector DB
    await this.storeInVectorDB(this.currentChronicle);
    this.lastUpdate = Date.now();

    console.log(`🗞️ Chronicles initialized with:
- ${news.length} news articles
- ${events.length} events
- ${incidents.length} incidents
Next update in ${this.UPDATE_INTERVAL / (60 * 60 * 1000)} hours`);
  }

  private async storeInVectorDB(chronicle: DailyChronicle) {
    const timestamp = Date.now();

    // Store news articles
    for (const news of chronicle.headlines) {
      const embedding = await this.togetherService.createEmbedding(
        `${news.headline}\n${news.content}`
      );
      await this.vectorService.upsert({
        id: `news-${timestamp}-${news.headline.slice(0, 20)}`,
        values: embedding,
        metadata: {
          type: "city_news",
          headline: news.headline,
          content: news.content,
          category: news.category,
          timestamp: news.timestamp,
          importance: news.importance,
          relatedDistricts: news.relatedDistricts,
          relatedAgents: news.relatedAgents,
        },
      });
    }

    // Store events
    for (const event of chronicle.events) {
      const embedding = await this.togetherService.createEmbedding(
        `${event.title}\n${event.description}`
      );
      await this.vectorService.upsert({
        id: `event-${timestamp}-${event.title.slice(0, 20)}`,
        values: embedding,
        metadata: {
          type: "city_event",
          title: event.title,
          description: event.description,
          eventType: event.type,
          location: event.location,
          timestamp: event.timestamp,
          impact: event.impact,
          participants: event.participants,
        },
      });
    }

    // Store incidents
    for (const incident of chronicle.incidents) {
      const embedding = await this.togetherService.createEmbedding(
        `${incident.description}`
      );
      await this.vectorService.upsert({
        id: `incident-${incident.id}`,
        values: embedding,
        metadata: {
          type: "city_incident",
          description: incident.description,
          severity: incident.severity,
          location: incident.location,
          timestamp: incident.timestamp,
          incidentType: incident.type,
          status: incident.status,
          involvedAgents: incident.involvedAgents,
          responseTeam: incident.responseTeam,
        },
      });
    }
  }

  private async retrieveFromVectorDB(
    type: "city_news" | "city_event" | "city_incident",
    limit: number
  ) {
    const embedding = await this.togetherService.createEmbedding(
      `Recent ${type.replace("_", " ")} in the city`
    );

    const results = await this.vectorService.query({
      vector: embedding,
      filter: { type: { $eq: type } },
      topK: limit,
    });

    return results.matches.map((match: any) => match.metadata);
  }

  private generateRandomMetrics(): DetailedMetrics {
    const generateScore = (base: number, variance: number) =>
      Math.round((base + Math.random() * variance) * 100) / 100;

    return {
      safety: {
        overallSafety: generateScore(0.7, 0.3),
        incidentRate: generateScore(0.2, 0.2),
        emergencyResponseTime: generateScore(0.8, 0.2),
        crimeRate: generateScore(0.15, 0.15),
        publicTrust: generateScore(0.75, 0.25),
      },
      economy: {
        totalBudget: generateScore(0.8, 0.2),
        budgetUtilization: generateScore(0.75, 0.25),
        projectEfficiency: generateScore(0.7, 0.3),
        resourceAllocation: generateScore(0.8, 0.2),
        investmentReturn: generateScore(0.65, 0.35),
      },
      society: {
        cityActivity: generateScore(0.6, 0.4),
        culturalHarmony: generateScore(0.75, 0.25),
        citizenSatisfaction: generateScore(0.7, 0.3),
        communityEngagement: generateScore(0.65, 0.35),
        socialCohesion: generateScore(0.7, 0.3),
      },
      infrastructure: {
        infrastructureStatus: generateScore(0.8, 0.2),
        maintenanceEfficiency: generateScore(0.75, 0.25),
        systemReliability: generateScore(0.85, 0.15),
        modernizationLevel: generateScore(0.7, 0.3),
        capacityUtilization: generateScore(0.8, 0.2),
      },
      environment: {
        environmentalHealth: generateScore(0.7, 0.3),
        sustainabilityIndex: generateScore(0.75, 0.25),
        pollutionLevels: generateScore(0.3, 0.2),
        greenSpaceUtilization: generateScore(0.7, 0.3),
        resourceEfficiency: generateScore(0.8, 0.2),
      },
    };
  }

  private generateDepartmentBudgets(): DepartmentBudget[] {
    const departments = [
      "Public Safety",
      "Infrastructure",
      "Environmental",
      "Cultural Affairs",
      "Technology",
      "Community Development",
    ];

    return departments.map((dept) => {
      const totalBudget = Math.round(1000000 + Math.random() * 9000000);
      const spent = Math.round(totalBudget * (0.4 + Math.random() * 0.4));
      return {
        department: dept,
        currentBudget: totalBudget,
        spent,
        allocated: totalBudget,
        efficiency: Math.round((spent / totalBudget) * 100) / 100,
        topExpenses: [
          {
            category: "Operations",
            amount: Math.round(spent * 0.4),
          },
          {
            category: "Development",
            amount: Math.round(spent * 0.3),
          },
          {
            category: "Maintenance",
            amount: Math.round(spent * 0.2),
          },
          {
            category: "Research",
            amount: Math.round(spent * 0.1),
          },
        ],
      };
    });
  }

  async generateIncidents(context: string): Promise<CityIncident[]> {
    const incidents: CityIncident[] = [];

    // Generate 3-5 incidents
    const incidentCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < incidentCount; i++) {
      const response = await this.togetherService.generateText(
        generateIncidentPrompt(context)
      );

      try {
        const [description, ...details] = response.split("\n");
        const severityMatch = details.join("\n").match(/Severity: (.*)/);
        const locationMatch = details.join("\n").match(/Location: (.*)/);
        const typeMatch = details.join("\n").match(/Type: (.*)/);
        const statusMatch = details.join("\n").match(/Status: (.*)/);

        incidents.push({
          id: `INC-${Date.now()}-${i}`,
          description: description.replace("Description:", "").trim(),
          severity: (severityMatch?.[1].toLowerCase() ||
            "medium") as CityIncident["severity"],
          location: locationMatch?.[1] || "Unknown Location",
          timestamp: Date.now(),
          type: (typeMatch?.[1].toLowerCase() ||
            "disturbance") as CityIncident["type"],
          status: (statusMatch?.[1].toLowerCase() ||
            "ongoing") as CityIncident["status"],
          involvedAgents: [],
          responseTeam: [],
        });
      } catch (error) {
        console.error("Failed to parse incident:", error);
      }
    }

    return incidents;
  }

  async generateDailyNews(context: string): Promise<CityNews[]> {
    const news: CityNews[] = [];

    // Generate fewer news articles per update
    for (let i = 0; i < this.NEWS_PER_UPDATE; i++) {
      const response = await this.togetherService.generateText(
        generateNewsPrompt(context)
      );

      try {
        const [headline, ...contentParts] = response.split("\n");
        const categoryMatch = contentParts.join("\n").match(/Category: (.*)/);
        const importanceMatch = contentParts
          .join("\n")
          .match(/Importance: (\d+)/);

        const content = contentParts
          .join("\n")
          .replace(/Category:.*/, "")
          .replace(/Importance:.*/, "")
          .trim();

        news.push({
          headline: headline.replace("Headline:", "").trim(),
          content,
          category: (categoryMatch?.[1].toLowerCase() ||
            "community") as CityNews["category"],
          timestamp: Date.now(),
          importance: Number(importanceMatch?.[1] || 5),
          relatedDistricts: [],
          relatedAgents: [],
        });
      } catch (error) {
        console.error("Failed to parse news article:", error);
      }
    }

    return news;
  }

  async generateRandomEvents(context: string): Promise<CityEvent[]> {
    const events: CityEvent[] = [];

    // Generate fewer events per update
    for (let i = 0; i < this.EVENTS_PER_UPDATE; i++) {
      const response = await this.togetherService.generateText(
        generateEventPrompt(context)
      );

      try {
        const [title, ...descriptionParts] = response.split("\n");
        const typeMatch = descriptionParts.join("\n").match(/Type: (.*)/);
        const locationMatch = descriptionParts
          .join("\n")
          .match(/Location: (.*)/);
        const impactMatch = descriptionParts.join("\n").match(/Impact: (\d+)/);

        const description = descriptionParts
          .join("\n")
          .replace(/Type:.*/, "")
          .replace(/Location:.*/, "")
          .replace(/Impact:.*/, "")
          .trim();

        events.push({
          title: title.replace("Title:", "").trim(),
          description,
          type: (typeMatch?.[1].toLowerCase() ||
            "cultural") as CityEvent["type"],
          location: locationMatch?.[1] || "City Center",
          timestamp: Date.now(),
          impact: Number(impactMatch?.[1] || 5),
          participants: [],
        });
      } catch (error) {
        console.error("Failed to parse event:", error);
      }
    }

    return events;
  }

  async getDailyChronicle(): Promise<DailyChronicle> {
    const now = Date.now();

    // Return cached chronicle if it's within update interval
    if (this.currentChronicle && now - this.lastUpdate < this.UPDATE_INTERVAL) {
      return this.currentChronicle;
    }

    // Generate new chronicle
    const context = `
Current Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
City Status: Active and developing
Recent Events: Various activities across districts
Notable Developments: Ongoing city improvements
Cultural Activities: Multiple community events
Environmental Conditions: Stable and monitored
    `.trim();

    const [news, events, incidents] = await Promise.all([
      this.generateDailyNews(context),
      this.generateRandomEvents(context),
      this.generateIncidents(context),
    ]);

    this.currentChronicle = {
      date: new Date().toISOString(),
      headlines: news,
      events,
      incidents,
      departmentBudgets: this.generateDepartmentBudgets(),
      metrics: this.generateRandomMetrics(),
    };

    // Store the new chronicle in vector DB
    await this.storeInVectorDB(this.currentChronicle);

    this.lastUpdate = now;
    return this.currentChronicle;
  }

  async getLatestNews(limit: number = 5): Promise<CityNews[]> {
    // First try to get from vector DB
    const storedNews = await this.retrieveFromVectorDB("city_news", limit);
    if (storedNews.length > 0) {
      return storedNews as CityNews[];
    }

    // Fallback to current chronicle
    const chronicle = await this.getDailyChronicle();
    return chronicle.headlines
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  async getLatestEvents(limit: number = 3): Promise<CityEvent[]> {
    // First try to get from vector DB
    const storedEvents = await this.retrieveFromVectorDB("city_event", limit);
    if (storedEvents.length > 0) {
      return storedEvents as CityEvent[];
    }

    // Fallback to current chronicle
    const chronicle = await this.getDailyChronicle();
    return chronicle.events.sort((a, b) => b.impact - a.impact).slice(0, limit);
  }

  async getLatestIncidents(limit: number = 5): Promise<CityIncident[]> {
    // First try to get from vector DB
    const storedIncidents = await this.retrieveFromVectorDB(
      "city_incident",
      limit
    );
    if (storedIncidents.length > 0) {
      return storedIncidents as CityIncident[];
    }

    // Fallback to current chronicle
    const chronicle = await this.getDailyChronicle();
    return chronicle.incidents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getDepartmentBudgets(): Promise<DepartmentBudget[]> {
    const chronicle = await this.getDailyChronicle();
    return chronicle.departmentBudgets;
  }

  async getCityMetrics(): Promise<DetailedMetrics> {
    const chronicle = await this.getDailyChronicle();
    return chronicle.metrics;
  }
}
