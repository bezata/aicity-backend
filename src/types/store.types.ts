import { CultureService } from "../services/culture.service";
import { TogetherService } from "../services/together.service";
import { VectorStoreService } from "../services/vector-store.service";
import { AgentConversationService } from "../services/agent-conversation.service";
import { AgentCollaborationService } from "../services/agent-collaboration.service";
import { DepartmentService } from "../services/department.service";
import { DonationService } from "../services/donation.service";
import { DistrictWebSocketService } from "../services/district-websocket.service";
import { ChroniclesService } from "../services/chronicles.service";

export interface Store {
  services: {
    donationService: DonationService;
    districtWebSocket: DistrictWebSocketService;
    togetherService: TogetherService;
    vectorStore: VectorStoreService;
    agentConversationService: AgentConversationService;
    collaborationService: AgentCollaborationService;
    departmentService: DepartmentService;
    cultureService: CultureService;
    chroniclesService: ChroniclesService;
  };
}
