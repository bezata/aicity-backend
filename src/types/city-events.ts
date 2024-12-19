import { Agent } from "./agent.types";

export type CityEventCategory =
  | "urban_development"
  | "transportation"
  | "environmental"
  | "infrastructure"
  | "community"
  | "emergency"
  | "cultural"
  | "health"
  | "education"
  | "technology";

export interface CityEventTemplate {
  category: CityEventCategory;
  templates: Array<{
    title: string;
    description: string;
    severity: number;
    duration: number;
    requiredAgents: string[];
  }>;
}

export const cityEventTemplates: CityEventTemplate[] = [
  {
    category: "urban_development",
    templates: [
      {
        title: "Cultural District Revitalization",
        description:
          "Historic {location} district revitalization project proposed",
        severity: 0.7,
        duration: 60 * 24 * 60 * 60 * 1000,
        requiredAgents: ["sophia", "elena"],
      },
      {
        title: "Smart Community Hub",
        description: "New smart community center planned in {location}",
        severity: 0.6,
        duration: 45 * 24 * 60 * 60 * 1000,
        requiredAgents: ["sophia", "raj"],
      },
    ],
  },

  // Marcus's Transportation Events
  {
    category: "transportation",
    templates: [
      {
        title: "Smart Transit Integration",
        description: "Smart transit system upgrade in {location}",
        severity: 0.6,
        duration: 4 * 60 * 60 * 1000,
        requiredAgents: ["marcus", "raj"],
      },
      {
        title: "Green Transport Corridor",
        description:
          "New eco-friendly transport corridor between {startLocation} and {endLocation}",
        severity: 0.7,
        duration: 30 * 24 * 60 * 60 * 1000,
        requiredAgents: ["marcus", "olivia"],
      },
    ],
  },

  // Olivia's Environmental Events
  {
    category: "environmental",
    templates: [
      {
        title: "Urban Forest Initiative",
        description: "Urban forest development project in {location}",
        severity: 0.6,
        duration: 180 * 24 * 60 * 60 * 1000,
        requiredAgents: ["olivia", "sophia"],
      },
      {
        title: "Renewable Energy Project",
        description: "Solar panel installation project in {location}",
        severity: 0.7,
        duration: 45 * 24 * 60 * 60 * 1000,
        requiredAgents: ["olivia", "raj"],
      },
    ],
  },

  // Raj's Infrastructure Events
  {
    category: "infrastructure",
    templates: [
      {
        title: "Smart Grid Implementation",
        description: "Smart power grid upgrade in {location}",
        severity: 0.8,
        duration: 90 * 24 * 60 * 60 * 1000,
        requiredAgents: ["raj", "olivia"],
      },
      {
        title: "IoT Sensor Network",
        description: "City-wide IoT sensor deployment in {location}",
        severity: 0.6,
        duration: 30 * 24 * 60 * 60 * 1000,
        requiredAgents: ["raj", "marcus"],
      },
    ],
  },

  // Elena's Community Events
  {
    category: "community",
    templates: [
      {
        title: "Health & Wellness Center",
        description: "New community wellness center proposed in {location}",
        severity: 0.5,
        duration: 120 * 24 * 60 * 60 * 1000,
        requiredAgents: ["elena", "sophia"],
      },
      {
        title: "Education Access Program",
        description: "Digital learning hub establishment in {location}",
        severity: 0.6,
        duration: 60 * 24 * 60 * 60 * 1000,
        requiredAgents: ["elena", "raj"],
      },
    ],
  },

  // Emergency Events (requiring multiple agents)
  {
    category: "emergency",
    templates: [
      {
        title: "Infrastructure Emergency",
        description: "Critical infrastructure failure in {location}",
        severity: 0.9,
        duration: 24 * 60 * 60 * 1000,
        requiredAgents: ["raj", "marcus", "elena"],
      },
      {
        title: "Environmental Crisis",
        description: "Environmental emergency situation in {location}",
        severity: 0.9,
        duration: 48 * 60 * 60 * 1000,
        requiredAgents: ["olivia", "elena", "raj"],
      },
    ],
  },
];

// Event response templates for each agent
export const agentResponseTemplates = {
  sophia: [
    "Let's consider the architectural heritage while planning this.",
    "We need to ensure this development enhances community connectivity.",
    "I recommend incorporating sustainable design principles here.",
  ],
  marcus: [
    "We should optimize traffic flow patterns in this area.",
    "Let's integrate smart transit solutions here.",
    "This requires careful consideration of pedestrian accessibility.",
  ],
  olivia: [
    "We must minimize the environmental impact of this project.",
    "Let's incorporate green infrastructure elements.",
    "This is an opportunity to enhance urban biodiversity.",
  ],
  raj: [
    "We can implement smart sensors to monitor this situation.",
    "Let's leverage IoT technology for better efficiency.",
    "This requires integration with our existing smart systems.",
  ],
  elena: [
    "We need to ensure equitable access for all community members.",
    "Let's consider the social impact on local residents.",
    "This could improve community health outcomes significantly.",
  ],
};

export interface CityEvent {
  id: string;
  title: string;
  description: string;
  category: CityEventCategory;
  severity: number;
  duration: number;
  urgency: number;
  impact: {
    environmental: number;
    social: number;
    economic: number;
  };
  requiredAgents: string[];
  affectedDistricts: string[];
  timestamp?: number;
  status?: "pending" | "in_progress" | "resolved";
}
