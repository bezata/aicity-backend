interface Agent {
  id: string;
  name: string;
  role: string;
  type: "resident" | "management";
}

export const residentAgents: Agent[] = [
  { id: "luna", name: "Luna", role: "Student", type: "resident" },
  { id: "max", name: "Max", role: "Business Owner", type: "resident" },
  { id: "sophia", name: "Sophia", role: "Artist", type: "resident" },
  { id: "oliver", name: "Oliver", role: "Teacher", type: "resident" },
];

export const cityManagementAgents: Agent[] = [
  {
    id: "mayor",
    name: "Mayor Johnson",
    role: "City Mayor",
    type: "management",
  },
  {
    id: "planner",
    name: "Urban Planner",
    role: "City Planner",
    type: "management",
  },
  {
    id: "safety",
    name: "Safety Director",
    role: "Public Safety",
    type: "management",
  },
  {
    id: "services",
    name: "Services Manager",
    role: "Public Services",
    type: "management",
  },
];

export const allCityAgents: Agent[] = [
  ...residentAgents,
  ...cityManagementAgents,
];
