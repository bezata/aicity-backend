import { EventEmitter } from "events";
import { DepartmentAgent } from "../types/department-agent.types";
import { CitizenNeed } from "../types/citizen.types";
import { TogetherService } from "./together.service";

export class DepartmentAgentService extends EventEmitter {
  private agents: Map<string, DepartmentAgent> = new Map();

  constructor(private togetherService: TogetherService) {
    super();
  }

  async handleCitizenNeed(need: CitizenNeed) {
    const availableAgents = Array.from(this.agents.values()).filter(
      (agent) => agent.schedule.availability && !agent.currentTask
    );

    if (availableAgents.length === 0) return;

    const agent = this.selectBestAgent(availableAgents, need);
    await this.assignTask(agent.id, {
      type: "citizen_request",
      description: need.description,
      priority:
        need.urgency > 0.7 ? "high" : need.urgency > 0.3 ? "medium" : "low",
    });
  }

  private selectBestAgent(
    agents: DepartmentAgent[],
    need: CitizenNeed
  ): DepartmentAgent {
    return agents.reduce((best, current) => {
      const score =
        current.performance.responseTime * 0.4 +
        current.performance.resolutionRate * 0.4 +
        current.performance.efficiency * 0.2;
      const bestScore =
        best.performance.responseTime * 0.4 +
        best.performance.resolutionRate * 0.4 +
        best.performance.efficiency * 0.2;
      return score > bestScore ? current : best;
    });
  }

  private async assignTask(
    agentId: string,
    task: DepartmentAgent["currentTask"]
  ) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.currentTask = task;
    this.emit("taskAssigned", { agentId, task });
  }
}
