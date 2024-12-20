export interface CityMetrics {
  sustainability: {
    carbonEmissions: number; // tons per capita
    renewableEnergyRatio: number; // 0-1
    greenSpaceIndex: number; // 0-1
    airQualityIndex: number; // 0-500
    waterQualityScore: number; // 0-1
    biodiversityIndex: number; // 0-1
  };

  economy: {
    employmentRate: number; // 0-1
    giniCoefficient: number; // 0-1
    businessFormationRate: number; // new businesses per 1000 residents
    innovationIndex: number; // 0-1
    housingAffordability: number; // median income / median house price
  };

  social: {
    healthcareAccessScore: number; // 0-1
    educationQualityIndex: number; // 0-1
    culturalEngagement: number; // events per capita
    civicParticipation: number; // 0-1
    communityWellbeing: number; // 0-1
  };

  infrastructure: {
    trafficCongestion: number; // 0-1 (1 being worst)
    publicTransitReliability: number; // 0-1
    wasteRecyclingRate: number; // 0-1
    infrastructureHealth: number; // 0-1
    smartGridEfficiency: number; // 0-1
  };

  safety: {
    crimeRate: number; // incidents per 1000 residents
    emergencyResponseTime: number; // minutes
    publicTrustIndex: number; // 0-1
    disasterReadiness: number; // 0-1
  };
}
