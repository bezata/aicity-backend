export interface CityMetrics {
  weather: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
    windDirection: string;
  };

  environmental: {
    airQuality: number;
    noiseLevel: number;
    waterQuality: number;
    greenCoverage: number;
    emissions: number;
  };

  emergency: {
    level: "normal" | "elevated" | "critical";
    activeIncidents: number;
    responseTeamsAvailable: number;
  };

  vitals: {
    populationCount: number;
    activeEntities: number;
    visitorCount: number;
    peakHoursStatus: string;
  };

  community: {
    activeEvents: number;
    ongoingMeetings: number;
    collaborationSessions: number;
    chatActivity: "Low" | "Medium" | "High";
  };

  safety: {
    overallScore: number;
    recentIncidents: number;
    responseTime: string;
    serviceAvailability: number;
    crimeRate: number;
    emergencyResponseTime: number;
    publicTrustIndex: number;
    disasterReadiness: number;
  };

  resources: {
    energyConsumption: number;
    waterUsage: number;
    wasteManagement: number;
    efficiency: number;
  };

  transport: {
    trafficDensity: number;
    publicTransportLoad: number;
    parkingAvailable: number;
    avgTransitTime: number;
    trafficCongestion: number;
    publicTransitReliability: number;
  };

  economic: {
    businessActivity: number;
    growthRate: number;
    activeTransactions: number;
    marketSentiment: string;
    employmentRate: number;
    giniCoefficient: number;
    businessFormationRate: number;
    innovationIndex: number;
    housingAffordability: number;
  };

  cultural: {
    eventAttendance: number;
    culturalSiteVisits: number;
    communityEngagement: number;
    socialCohesion: number;
    culturalEngagement: number;
    civicParticipation: number;
  };

  infrastructure: {
    maintenanceRequests: number;
    serviceUptime: number;
    healthScore: number;
    developmentProgress: number;
    wasteRecyclingRate: number;
    smartGridEfficiency: number;
  };

  budget: {
    currentStatus: number;
    monthlySpending: number;
    efficiency: number;
    allocation: {
      infrastructure: number;
      services: number;
      development: number;
      emergency: number;
    };
  };

  departments: {
    responseTimes: number;
    serviceQuality: number;
    resourceUtilization: number;
    efficiency: number;
  };

  donations: {
    activeCampaigns: number;
    totalDonations: number;
    goalProgress: number;
    impactScore: number;
  };

  sustainability: {
    carbonEmissions: number;
    renewableEnergyRatio: number;
    greenSpaceIndex: number;
    airQualityIndex: number;
    waterQualityScore: number;
    biodiversityIndex: number;
  };

  social: {
    healthcareAccessScore: number;
    educationQualityIndex: number;
    communityWellbeing: number;
  };
}
