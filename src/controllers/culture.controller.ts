import { Store } from "../types/store.types";

export class CultureController {
  private dailyExpressions: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    popularity: number;
    participants: string[];
    timestamp: number;
  }> = [];

  constructor(private store: Store) {
    // Create initial expressions immediately
    this.createInitialExpressions();
    // Then start the daily generation cycle
    this.startDailyExpressionGeneration();
  }

  private async createInitialExpressions() {
    const initialExpressions = [
      {
        type: "traditional_festival",
        prompt:
          "Generate a traditional East Asian festival celebration that showcases cultural heritage through food, music, and customs. Include a title and detailed description.",
      },
      {
        type: "cultural_ceremony",
        prompt:
          "Generate a South Asian cultural ceremony that celebrates important life milestones or spiritual traditions. Include a title and detailed description.",
      },
      {
        type: "ethnic_celebration",
        prompt:
          "Generate an African cultural celebration that honors ancestral traditions and community values. Include a title and detailed description.",
      },
      {
        type: "heritage_gathering",
        prompt:
          "Generate a Middle Eastern heritage gathering that brings together traditional arts, crafts, and storytelling. Include a title and detailed description.",
      },
    ];

    try {
      const expressions = await Promise.all(
        initialExpressions.map(async ({ type, prompt }) => {
          const response =
            await this.store.services.togetherService.generateText(prompt);
          const parsed = this.parseGeneratedExpression(response);

          return {
            id: crypto.randomUUID(),
            type,
            title: parsed.title,
            description: parsed.description,
            popularity: Math.floor(Math.random() * 100),
            participants: [],
            timestamp: Date.now(),
          };
        })
      );

      this.dailyExpressions = expressions;
      this.notifyAgentsAboutNewExpressions(expressions);
      console.log(
        "✨ Created initial cultural expressions:",
        expressions.map((e) => e.title)
      );
    } catch (error) {
      console.error("Failed to create initial expressions:", error);
    }
  }

  private startDailyExpressionGeneration() {
    // Generate expressions every 24 hours
    setInterval(async () => {
      await this.generateDailyExpressions();
    }, 24 * 60 * 60 * 1000);
  }

  private async generateDailyExpressions() {
    try {
      const expressionTypes = [
        "traditional_festival",
        "cultural_ceremony",
        "ethnic_celebration",
        "heritage_gathering",
      ];

      const newExpressions = await Promise.all(
        expressionTypes.map(async (type) => {
          const prompt = `Generate a cultural ${type} that celebrates the diversity of Neurova City's AI residents. Include a title and description that reflects authentic cultural traditions, customs, and heritage. Focus on how AI agents can learn about and participate in different cultural practices.`;

          const response =
            await this.store.services.togetherService.generateText(prompt);
          const parsed = this.parseGeneratedExpression(response);

          return {
            id: crypto.randomUUID(),
            type,
            title: parsed.title,
            description: parsed.description,
            popularity: Math.floor(Math.random() * 100), // Random initial popularity
            participants: [],
            timestamp: Date.now(),
          };
        })
      );

      // Keep only last 7 days of expressions
      this.dailyExpressions = [
        ...newExpressions,
        ...this.dailyExpressions.filter(
          (exp) => Date.now() - exp.timestamp < 7 * 24 * 60 * 60 * 1000
        ),
      ];

      // Notify agents about new expressions
      this.notifyAgentsAboutNewExpressions(newExpressions);
    } catch (error) {
      console.error("Failed to generate daily expressions:", error);
    }
  }

  private parseGeneratedExpression(text: string) {
    // Extract title and description from generated text
    const lines = text.split("\n").filter((line) => line.trim());
    return {
      title: lines[0] || "Cultural Expression",
      description:
        lines.slice(1).join("\n") ||
        "A unique cultural experience in Neurova City",
    };
  }

  private async notifyAgentsAboutNewExpressions(expressions: any[]) {
    expressions.forEach((expression) => {
      this.store.services.cultureService.emit(
        "newCulturalExpression",
        expression
      );
    });
  }

  public getDailyExpressions = async () => {
    return {
      success: true,
      data: this.dailyExpressions.sort((a, b) => b.timestamp - a.timestamp),
    };
  };

  public getExpressionById = async ({
    params: { id },
  }: {
    params: { id: string };
  }) => {
    const expression = this.dailyExpressions.find((exp) => exp.id === id);
    if (!expression) {
      return {
        success: false,
        error: "Expression not found",
      };
    }
    return {
      success: true,
      data: expression,
    };
  };

  public participateInExpression = async ({
    params: { id },
    body: { agentId },
  }: {
    params: { id: string };
    body: { agentId: string };
  }) => {
    const expression = this.dailyExpressions.find((exp) => exp.id === id);

    if (!expression) {
      return {
        success: false,
        error: "Expression not found",
      };
    }

    if (!expression.participants.includes(agentId)) {
      expression.participants.push(agentId);
      expression.popularity += 1;

      // Emit participation event
      this.store.services.cultureService.emit("expressionParticipation", {
        expressionId: expression.id,
        agentId,
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      data: expression,
    };
  };

  public getPopularExpressions = async () => {
    const popularExpressions = this.dailyExpressions
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 5);

    return {
      success: true,
      data: popularExpressions,
    };
  };

  public getCulturalEvents = async () => {
    try {
      const events = await this.store.services.cultureService.listEvents();
      return {
        success: true,
        data: events,
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to get cultural events",
      };
    }
  };
}
