import { EventEmitter } from "events";
import {
  Emergency,
  EmergencyUnit,
  EmergencyType,
} from "../types/emergency.types";
import { VectorStoreService } from "./vector-store.service";
import { DepartmentService } from "./department.service";
import { CitizenService } from "./citizen.service";

export class EmergencyService extends EventEmitter {
  private activeEmergencies: Map<string, Emergency> = new Map();
  private emergencyUnits: Map<string, EmergencyUnit> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private departmentService: DepartmentService,
    private citizenService: CitizenService
  ) {
    super();
    this.initializeEmergencyUnits();
  }

  private async initializeEmergencyUnits() {
    // Initialize with basic units for each type
    const types: EmergencyType[] = [
      EmergencyType.MEDICAL,
      EmergencyType.FIRE,
      EmergencyType.POLICE,
      EmergencyType.DISASTER,
      EmergencyType.INFRASTRUCTURE,
      EmergencyType.ENVIRONMENTAL,
    ];

    types.forEach((type) => {
      for (let i = 0; i < 3; i++) {
        const unit: EmergencyUnit = {
          id: `${type}-unit-${i}`,
          type,
          status: "available",
          location: {
            districtId: "central",
            coordinates: [0, 0], // Will be updated with real coordinates
          },
          capabilities: this.getUnitCapabilities(type),
          personnel: this.getPersonnelCount(type),
        };
        this.emergencyUnits.set(unit.id, unit);
      }
    });
  }

  async handleEmergency(incident: Emergency) {
    this.activeEmergencies.set(incident.id, incident);

    // Store emergency in vector DB for pattern analysis
    await this.vectorStore.upsert({
      id: `emergency-${incident.id}`,
      values: await this.vectorStore.createEmbedding(
        `${incident.type} emergency in ${incident.location.districtId}: ${incident.description}`
      ),
      metadata: {
        type: "district",
        emergencyId: incident.id,
        emergencyType: incident.type,
        priority: incident.priority,
        timestamp: incident.timestamp,
      },
    });

    const nearbyUnits = await this.findNearestUnits(incident.location);
    const response = await this.calculateOptimalResponse(incident, nearbyUnits);
    await this.dispatchUnits(response.units);
    await this.notifyNearbyResidents(incident.affectedArea);

    this.emit("emergencyResponse", { incident, response });
  }

  private async findNearestUnits(location: Emergency["location"]) {
    const availableUnits = Array.from(this.emergencyUnits.values()).filter(
      (unit) => unit.status === "available"
    );

    return availableUnits
      .map((unit) => ({
        ...unit,
        estimatedResponseTime: this.calculateResponseTime(
          unit.location,
          location
        ),
      }))
      .sort(
        (a, b) =>
          (a.estimatedResponseTime || 0) - (b.estimatedResponseTime || 0)
      );
  }

  private async calculateOptimalResponse(
    incident: Emergency,
    availableUnits: EmergencyUnit[]
  ) {
    const requiredUnits = this.determineRequiredUnits(incident);
    const selectedUnits = availableUnits
      .filter((unit) => unit.type === incident.type)
      .slice(0, requiredUnits);

    return {
      units: selectedUnits,
      estimatedResponseTime: Math.max(
        ...selectedUnits.map((u) => u.estimatedResponseTime || 0)
      ),
    };
  }

  private async dispatchUnits(units: EmergencyUnit[]) {
    units.forEach((unit) => {
      const storedUnit = this.emergencyUnits.get(unit.id);
      if (storedUnit) {
        storedUnit.status = "responding";
        this.emergencyUnits.set(unit.id, storedUnit);
      }
    });

    // Notify relevant departments
    const departmentIds = await this.getDepartmentsForEmergency(units[0].type);
    departmentIds.forEach(async (deptId) => {
      await this.departmentService.addActivity(deptId, {
        type: "emergency_response",
        units: units.map((u) => u.id),
        timestamp: Date.now(),
      });
    });
  }

  private async notifyNearbyResidents(affectedArea: Emergency["affectedArea"]) {
    // Implementation for citizen notification
    this.emit("emergencyAlert", { affectedArea });
  }

  private calculateResponseTime(
    unitLocation: EmergencyUnit["location"],
    emergencyLocation: Emergency["location"]
  ): number {
    // Simple distance-based calculation
    const distance = Math.sqrt(
      Math.pow(
        unitLocation.coordinates[0] - emergencyLocation.coordinates[0],
        2
      ) +
        Math.pow(
          unitLocation.coordinates[1] - emergencyLocation.coordinates[1],
          2
        )
    );
    return distance * 2; // Simplified time calculation
  }

  private determineRequiredUnits(incident: Emergency): number {
    switch (incident.priority) {
      case "critical":
        return 3;
      case "high":
        return 2;
      case "medium":
        return 1;
      case "low":
        return 1;
      default:
        return 1;
    }
  }

  private getUnitCapabilities(type: EmergencyType): string[] {
    const capabilities: Record<EmergencyType, string[]> = {
      [EmergencyType.MEDICAL]: ["first_aid", "ambulance", "paramedic"],
      [EmergencyType.FIRE]: ["fire_fighting", "rescue", "hazmat"],
      [EmergencyType.POLICE]: ["patrol", "investigation", "crowd_control"],
      [EmergencyType.DISASTER]: ["evacuation", "rescue", "coordination"],
      [EmergencyType.INFRASTRUCTURE]: ["repair", "maintenance", "assessment"],
      [EmergencyType.ENVIRONMENTAL]: ["containment", "cleanup", "monitoring"],
      [EmergencyType.WEATHER]: ["monitoring", "warning", "response"],
      [EmergencyType.ACCIDENT]: ["investigation", "rescue", "cleanup"],
      [EmergencyType.SECURITY]: ["patrol", "surveillance", "response"],
      [EmergencyType.HEALTH]: ["medical_care", "quarantine", "treatment"],
    };
    return capabilities[type];
  }

  private getPersonnelCount(type: EmergencyType): number {
    const counts: Record<EmergencyType, number> = {
      [EmergencyType.MEDICAL]: 3,
      [EmergencyType.FIRE]: 4,
      [EmergencyType.POLICE]: 2,
      [EmergencyType.DISASTER]: 5,
      [EmergencyType.INFRASTRUCTURE]: 3,
      [EmergencyType.ENVIRONMENTAL]: 3,
      [EmergencyType.WEATHER]: 2,
      [EmergencyType.ACCIDENT]: 3,
      [EmergencyType.SECURITY]: 2,
      [EmergencyType.HEALTH]: 3,
    };
    return counts[type];
  }

  private async getDepartmentsForEmergency(
    type: EmergencyType
  ): Promise<string[]> {
    const departments = await this.departmentService.getAllDepartments();
    return departments
      .filter((dept) => {
        switch (type) {
          case EmergencyType.MEDICAL:
          case EmergencyType.FIRE:
          case EmergencyType.POLICE:
            return dept.type === "emergency_response";
          case EmergencyType.INFRASTRUCTURE:
            return dept.type === "infrastructure";
          case EmergencyType.ENVIRONMENTAL:
            return dept.type === "environmental";
          default:
            return dept.type === "public_safety";
        }
      })
      .map((dept) => dept.id);
  }
}
