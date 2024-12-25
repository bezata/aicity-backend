import { DonationService } from "../services/donation.service";
import { DepartmentService } from "../services/department.service";
import { VectorStore } from "./vector-store.types";

export interface AppStore {
  services: {
    donationService: DonationService;
    departmentService: DepartmentService;
    vectorStore: VectorStore;
  };
}
