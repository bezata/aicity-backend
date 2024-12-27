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
[NEUROVA DAILY NEWS]
Context: ${context}

Generate news article:
Headline: [Headline]
Content: [2-3 paragraphs]
Category: [politics/culture/infrastructure/environment/technology/community]
Importance: [1-10]

Style: Journalistic, fact-focused, city newspaper format.`;

const generateEventPrompt = (context: string) => `
[NEUROVA EVENT]
Context: ${context}

Generate a concise city event description:
Title: [Title]
Description: [2-3 sentences about the event]
Type: [celebration/incident/development/cultural/emergency]
Location: [Specific venue name]
Impact: [1-10]

Style: Direct, factual, no meta-text or templates.`;

const generateIncidentPrompt = (context: string) => `
[NEUROVA INCIDENT]
Context: ${context}

Generate a concise incident report:
Description: [1-2 clear sentences]
Severity: [low/medium/high/critical]
Location: [Specific location]
Type: [crime/accident/disturbance/emergency/infrastructure]
Status: [ongoing/resolved/under_investigation]

Style: Direct, factual emergency report format.`;

export class ChroniclesService {
  private lastUpdate: number = 0;
  private currentChronicle: DailyChronicle | null = null;
  private readonly UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
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
NEUROVA Initial City Status Report
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
        // Rest of the parsing logic remains the same
        const lines = response.split("\n").map((line) => line.trim());
        let description = "",
          severity = "medium",
          location = "",
          type = "disturbance",
          status = "ongoing";

        for (const line of lines) {
          if (line.startsWith("Description:")) {
            description = line.replace("Description:", "").trim();
          } else if (line.startsWith("Severity:")) {
            severity = line.replace("Severity:", "").trim().toLowerCase();
          } else if (line.startsWith("Location:")) {
            location = line.replace("Location:", "").trim();
          } else if (line.startsWith("Type:")) {
            type = line.replace("Type:", "").trim().toLowerCase();
          } else if (line.startsWith("Status:")) {
            status = line.replace("Status:", "").trim().toLowerCase();
          } else if (
            !line.startsWith("[") &&
            !line.startsWith("Context:") &&
            line.length > 0
          ) {
            if (description) description += " ";
            description += line;
          }
        }

        // Clean up description - remove meta-questions and suggestions
        description = description
          .replace(/\?/g, ".")
          .replace(
            /would you like|shall i|should i|do you want|can i|let me know|please tell me|i can|i will|i could|i would/gi,
            ""
          )
          .replace(/\s+/g, " ")
          .trim();

        // Remove any sentence containing meta-text
        const sentences = description
          .split(/[.!?]+/)
          .filter(
            (sentence) =>
              !sentence.match(
                /would you like|shall i|should i|do you want|can i|let me know|please tell me|i can|i will|i could|i would/i
              )
          );
        description = sentences.join(". ").trim() + ".";

        // Validate severity
        const validSeverities = ["low", "medium", "high", "critical"];
        if (!validSeverities.includes(severity)) {
          severity = "medium";
        }

        // Validate type
        const validTypes = [
          "crime",
          "accident",
          "disturbance",
          "emergency",
          "infrastructure",
        ];
        if (!validTypes.includes(type)) {
          type = "disturbance";
        }

        // Validate status
        const validStatuses = ["ongoing", "resolved", "under_investigation"];
        if (!validStatuses.includes(status)) {
          status = "ongoing";
        }

        // Additional validation to prevent meta-responses
        const invalidPatterns = [
          "please provide",
          "let me know",
          "information needed",
          "following details",
          "guidelines",
          "procedures",
          "you are tasked",
          "write a report",
          "document the",
          "[",
          "]",
          "*",
          "would you like",
          "shall i",
          "should i",
          "can i help",
          "do you want",
          "i can generate",
          "i will provide",
        ];

        const hasInvalidPattern = invalidPatterns.some(
          (pattern) =>
            description.toLowerCase().includes(pattern) ||
            location.toLowerCase().includes(pattern)
        );

        // Validate content length and structure
        const isValidContent =
          description.length >= 50 && // Minimum description length
          description.length <= 500 && // Maximum description length
          !hasInvalidPattern && // No meta-text patterns
          location.length >= 3 && // Minimum location length
          location.length <= 50; // Maximum location length

        // Only add the incident if we have valid content
        if (description && location && isValidContent) {
          incidents.push({
            id: `INC-${Date.now()}-${i}`,
            description,
            severity: severity as CityIncident["severity"],
            location,
            timestamp: Date.now(),
            type: type as CityIncident["type"],
            status: status as CityIncident["status"],
            involvedAgents: [],
            responseTeam: [],
          });
        } else {
          // If invalid, try again
          i--;
          continue;
        }
      } catch (error) {
        console.error("Failed to parse incident:", error);
        // If failed, try again
        i--;
        continue;
      }
    }

    return incidents;
  }

  async generateDailyNews(context: string): Promise<CityNews[]> {
    const news: CityNews[] = [];

    // Generate news articles per update
    for (let i = 0; i < this.NEWS_PER_UPDATE; i++) {
      const response = await this.togetherService.generateText(
        generateNewsPrompt(context)
      );

      try {
        // Parse the response with more robust error handling
        const lines = response.split("\n").map((line) => line.trim());
        let headline = "",
          content = "",
          category = "community",
          importance = 5;

        for (const line of lines) {
          if (line.startsWith("Headline:")) {
            headline = line.replace("Headline:", "").trim();
          } else if (line.startsWith("Content:")) {
            content = line.replace("Content:", "").trim();
          } else if (line.startsWith("Category:")) {
            category = line.replace("Category:", "").trim().toLowerCase();
          } else if (line.startsWith("Importance:")) {
            importance = parseInt(line.replace("Importance:", "").trim()) || 5;
          } else if (
            !line.startsWith("[") &&
            !line.startsWith("Context:") &&
            line.length > 0
          ) {
            if (content) content += "\n";
            content += line;
          }
        }

        // Validate category
        const validCategories = [
          "politics",
          "culture",
          "infrastructure",
          "environment",
          "technology",
          "community",
        ];
        if (!validCategories.includes(category)) {
          category = "community";
        }

        // Validate importance
        importance = Math.max(1, Math.min(10, importance));

        // Additional validation to prevent meta-responses
        const invalidPatterns = [
          "please provide",
          "let me know",
          "information needed",
          "following details",
          "I'll use these",
          "I will assist",
          "required for this task",
        ];

        const hasInvalidPattern = invalidPatterns.some(
          (pattern) =>
            content.toLowerCase().includes(pattern) ||
            headline.toLowerCase().includes(pattern)
        );

        // Validate content length and structure
        const isValidContent =
          content.length >= 100 && // Minimum content length
          content.length <= 2000 && // Maximum content length
          !hasInvalidPattern && // No meta-text patterns
          !content.includes("*") && // No markdown
          !content.includes("[") && // No placeholders
          !headline.includes("required") && // No meta-headlines
          headline.length >= 10 && // Minimum headline length
          headline.length <= 100; // Maximum headline length

        // Only add the news if we have valid headline and content
        if (headline && content && isValidContent) {
          news.push({
            headline,
            content,
            category: category as CityNews["category"],
            timestamp: Date.now(),
            importance,
            relatedDistricts: [],
            relatedAgents: [],
          });
        } else {
          // If invalid, try again
          i--;
          continue;
        }
      } catch (error) {
        console.error("Failed to parse news article:", error);
        // If failed, try again
        i--;
        continue;
      }
    }

    return news;
  }

  async generateRandomEvents(context: string): Promise<CityEvent[]> {
    const events: CityEvent[] = [];

    // Generate events per update
    for (let i = 0; i < this.EVENTS_PER_UPDATE; i++) {
      const response = await this.togetherService.generateText(
        generateEventPrompt(context)
      );

      try {
        // Parse the response with robust error handling
        const lines = response.split("\n").map((line) => line.trim());
        let title = "",
          description = "",
          type = "cultural",
          location = "City Center",
          impact = 5;

        for (const line of lines) {
          if (line.startsWith("Title:")) {
            title = line.replace("Title:", "").trim();
          } else if (line.startsWith("Description:")) {
            description = line.replace("Description:", "").trim();
          } else if (line.startsWith("Type:")) {
            type = line.replace("Type:", "").trim().toLowerCase();
          } else if (line.startsWith("Location:")) {
            location = line.replace("Location:", "").trim();
          } else if (line.startsWith("Impact:")) {
            impact = parseInt(line.replace("Impact:", "").trim()) || 5;
          } else if (
            !line.startsWith("[") &&
            !line.startsWith("Context:") &&
            line.length > 0
          ) {
            if (description) description += " ";
            description += line;
          }
        }

        // Validate event type
        const validTypes = [
          "celebration",
          "incident",
          "development",
          "cultural",
          "emergency",
        ];
        if (!validTypes.includes(type)) {
          type = "cultural";
        }

        // Validate impact
        impact = Math.max(1, Math.min(10, impact));

        // Additional validation to prevent meta-responses
        const invalidPatterns = [
          "please provide",
          "let me know",
          "information needed",
          "following details",
          "I'll use these",
          "I will assist",
          "required for this task",
          "[",
          "]",
          "*",
          "write here",
        ];

        const hasInvalidPattern = invalidPatterns.some(
          (pattern) =>
            description.toLowerCase().includes(pattern) ||
            title.toLowerCase().includes(pattern) ||
            location.toLowerCase().includes(pattern)
        );

        // Validate content length and structure
        const isValidContent =
          description.length >= 50 && // Minimum description length
          description.length <= 1000 && // Maximum description length
          !hasInvalidPattern && // No meta-text patterns
          title.length >= 10 && // Minimum title length
          title.length <= 100 && // Maximum title length
          location.length >= 3 && // Minimum location length
          location.length <= 50; // Maximum location length

        // Only add the event if we have valid content
        if (title && description && location && isValidContent) {
          events.push({
            title,
            description,
            type: type as CityEvent["type"],
            location,
            timestamp: Date.now(),
            impact,
            participants: [],
          });
        } else {
          // If invalid, try again
          i--;
          continue;
        }
      } catch (error) {
        console.error("Failed to parse event:", error);
        // If failed, try again
        i--;
        continue;
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
