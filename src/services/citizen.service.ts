import { EventEmitter } from "events";
import { Citizen, CitizenNeed } from "../types/citizen.types";
import { VectorStoreService } from "./vector-store.service";
import { TogetherService } from "./together.service";
import { DepartmentService } from "./department.service";

export class CitizenService extends EventEmitter {
  private citizens: Map<string, Citizen> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private togetherService: TogetherService,
    private departmentService: DepartmentService
  ) {
    super();
  }

  async simulateCitizenNeeds() {
    for (const citizen of this.citizens.values()) {
      if (Math.random() < 0.3) {
        // 30% chance of new need
        const need = await this.generateRandomNeed(citizen);
        citizen.needs.push(need);
        await this.routeNeedToDepartment(citizen.id, need);
      }
    }
  }

  private async generateRandomNeed(citizen: Citizen): Promise<CitizenNeed> {
    const needTypes = [
      "infrastructure",
      "service",
      "safety",
      "environmental",
      "social",
    ];
    const type = needTypes[
      Math.floor(Math.random() * needTypes.length)
    ] as CitizenNeed["type"];

    const prompt = `Generate a realistic city-related need for a citizen who works as ${citizen.occupation} in the ${citizen.district} district.`;
    const description = await this.togetherService.generateText(prompt);

    return {
      type,
      description,
      urgency: Math.random(),
      status: "pending",
      created: Date.now(),
    };
  }

  private async routeNeedToDepartment(citizenId: string, need: CitizenNeed) {
    // Store in vector DB for pattern analysis
    await this.vectorStore.upsert({
      id: `citizen-need-${citizenId}-${Date.now()}`,
      values: await this.vectorStore.createEmbedding(need.description),
      metadata: {
        type: "district",
        citizenId,
        needType: need.type,
        urgency: need.urgency,
        timestamp: need.created,
      },
    });

    this.emit("newCitizenNeed", { citizenId, need });
  }

  async updateActivityLevels(type: string, intensity: number): Promise<void> {
    for (const citizen of this.citizens.values()) {
      // Update activity state for each citizen
      citizen.currentActivity = {
        type,
        intensity,
        timestamp: Date.now(),
      };

      // Emit activity update event
      this.emit("citizenActivityUpdated", {
        citizenId: citizen.id,
        activity: citizen.currentActivity,
      });
    }
  }
}
