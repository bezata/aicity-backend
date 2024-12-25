import { CityEventCategory } from "./city-events";

export interface DonationGoal {
  id: string;
  departmentId: string;
  targetAmount: number;
  currentAmount: number;
  title: string;
  description: string;
  celebrationEvent: {
    title: string;
    description: string;
    duration: number; // in milliseconds
    category: CityEventCategory;
    impact: {
      social: number;
      economic: number;
      cultural: number;
      environmental: number;
    };
  };
}

export const DONATION_GOALS: DonationGoal[] = [
  {
    id: "education-tech-fund",
    departmentId: "education",
    targetAmount: 100000,
    currentAmount: 0,
    title: "Educational Technology Fund",
    description:
      "Help modernize our schools with the latest educational technology",
    celebrationEvent: {
      title: "Tech Innovation Festival",
      description:
        "A city-wide celebration showcasing new educational technology and student innovations",
      duration: 3600000, // 1 hour
      category: "cultural",
      impact: {
        social: 0.8,
        economic: 0.6,
        cultural: 0.9,
        environmental: 0.3,
      },
    },
  },
  {
    id: "green-spaces-initiative",
    departmentId: "parks",
    targetAmount: 75000,
    currentAmount: 0,
    title: "Green Spaces Initiative",
    description:
      "Create and maintain new parks and green spaces across the city",
    celebrationEvent: {
      title: "Green City Festival",
      description:
        "A celebration of nature with tree planting ceremonies and environmental workshops",
      duration: 3600000, // 1 hour
      category: "environmental",
      impact: {
        social: 0.7,
        economic: 0.4,
        cultural: 0.6,
        environmental: 0.9,
      },
    },
  },
  {
    id: "healthcare-outreach",
    departmentId: "health",
    targetAmount: 150000,
    currentAmount: 0,
    title: "Healthcare Outreach Program",
    description: "Expand healthcare services to underserved communities",
    celebrationEvent: {
      title: "Community Health Fair",
      description:
        "A festival celebrating health and wellness with free health screenings and fitness activities",
      duration: 3600000, // 1 hour
      category: "community",
      impact: {
        social: 0.9,
        economic: 0.5,
        cultural: 0.7,
        environmental: 0.4,
      },
    },
  },
  {
    id: "arts-culture-fund",
    departmentId: "culture",
    targetAmount: 50000,
    currentAmount: 0,
    title: "Arts & Culture Fund",
    description: "Support local artists and cultural programs",
    celebrationEvent: {
      title: "Cultural Arts Festival",
      description:
        "A vibrant celebration of local arts, music, and cultural performances",
      duration: 3600000, // 1 hour
      category: "cultural",
      impact: {
        social: 0.8,
        economic: 0.6,
        cultural: 1.0,
        environmental: 0.2,
      },
    },
  },
  {
    id: "infrastructure-improvement",
    departmentId: "infrastructure",
    targetAmount: 200000,
    currentAmount: 0,
    title: "Infrastructure Improvement Fund",
    description: "Upgrade city infrastructure for better living",
    celebrationEvent: {
      title: "City Progress Celebration",
      description:
        "A community gathering to celebrate infrastructure improvements with tours and demonstrations",
      duration: 3600000, // 1 hour
      category: "development",
      impact: {
        social: 0.7,
        economic: 0.9,
        cultural: 0.5,
        environmental: 0.6,
      },
    },
  },
];
