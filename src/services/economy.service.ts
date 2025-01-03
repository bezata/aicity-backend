import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { DistrictService } from "./district.service";

interface MarketMetrics {
  businessActivity: number;
  jobMarket: number;
  propertyValues: number;
  investmentFlow: number;
  consumerConfidence: number;
  aiEconomicActivity?: number;
  computationalResources?: number;
  dataMarketMetrics?: number;
}

interface EconomicIndicators {
  gdp: number;
  inflation: number;
  unemployment: number;
  economicGrowth: number;
  marketStability: number;
  aiProductivity?: number;
  digitalTransformation?: number;
  innovationIndex?: number;
}

interface BusinessActivity {
  id: string;
  type:
    | "retail"
    | "service"
    | "manufacturing"
    | "technology"
    | "cultural"
    | "ai_services"
    | "data_processing";
  districtId: string;
  revenue: number;
  employment: number;
  growth: number;
  stability: number;
  culturalImpact: number;
  aiIntegration?: number;
  dataUtilization?: number;
}

interface PropertyMarket {
  districtId: string;
  residentialValue: number;
  commercialValue: number;
  developmentPotential: number;
  culturalSignificance: number;
  marketTrend: "rising" | "stable" | "declining";
}

interface JobMarket {
  districtId: string;
  openPositions: number;
  skillsDemand: Record<string, number>;
  averageSalary: number;
  employmentRate: number;
  jobCreationRate: number;
}

interface Investment {
  id: string;
  type: "infrastructure" | "business" | "cultural" | "technology";
  amount: number;
  districtId: string;
  expectedReturn: number;
  culturalValue: number;
  socialImpact: number;
}

export class EconomyService extends EventEmitter {
  private marketMetrics: Map<string, MarketMetrics> = new Map();
  private economicIndicators: EconomicIndicators = {
    gdp: 0,
    inflation: 0,
    unemployment: 0,
    economicGrowth: 0,
    marketStability: 0,
    aiProductivity: 0,
    digitalTransformation: 0,
    innovationIndex: 0,
  };
  private businesses: Map<string, BusinessActivity> = new Map();
  private propertyMarkets: Map<string, PropertyMarket> = new Map();
  private jobMarkets: Map<string, JobMarket> = new Map();
  private investments: Map<string, Investment> = new Map();

  constructor(
    private vectorStore: VectorStoreService,
    private districtService: DistrictService
  ) {
    super();
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    setInterval(() => this.updateAIEconomicMetrics(), 1000 * 60 * 5); // Every 5 minutes
    setInterval(() => this.analyzeDataMarket(), 1000 * 60 * 15); // Every 15 minutes
    setInterval(() => this.calculateInnovationMetrics(), 1000 * 60 * 30); // Every 30 minutes
  }

  private async updateAIEconomicMetrics() {
    const districts = await this.districtService.getAllDistricts();

    for (const district of districts) {
      const metrics =
        this.marketMetrics.get(district.id) || ({} as MarketMetrics);
      const aiBusinesses = Array.from(this.businesses.values()).filter(
        (b) =>
          b.districtId === district.id &&
          (b.type === "ai_services" || b.type === "data_processing")
      );

      metrics.aiEconomicActivity = this.calculateAIActivity(aiBusinesses);
      metrics.computationalResources = this.assessComputationalResources(
        district.id
      );
      metrics.dataMarketMetrics = this.evaluateDataMarket(district.id);

      this.marketMetrics.set(district.id, metrics);
      this.emit("aiMetricsUpdated", { districtId: district.id, metrics });
    }
  }

  private async analyzeDataMarket() {
    const districts = await this.districtService.getAllDistricts();

    for (const district of districts) {
      const dataMarketValue = await this.calculateDataMarketValue(district.id);
      const dataTrading = await this.assessDataTrading(district.id);
      const dataUtilization = await this.measureDataUtilization(district.id);

      this.emit("dataMarketUpdated", {
        districtId: district.id,
        metrics: { dataMarketValue, dataTrading, dataUtilization },
      });
    }
  }

  private async calculateInnovationMetrics() {
    const aiBusinesses = Array.from(this.businesses.values()).filter(
      (b) => b.type === "ai_services" || b.type === "data_processing"
    );

    const innovationIndex = this.calculateInnovationIndex(aiBusinesses);
    const digitalTransformation = this.assessDigitalTransformation();

    this.economicIndicators.innovationIndex = innovationIndex;
    this.economicIndicators.digitalTransformation = digitalTransformation;

    this.emit("innovationMetricsUpdated", {
      innovationIndex,
      digitalTransformation,
    });
  }

  private calculateAIActivity(aiBusinesses: BusinessActivity[]): number {
    if (!aiBusinesses.length) return 0;
    return (
      aiBusinesses.reduce(
        (sum, business) =>
          sum +
          (business.revenue * 0.4 +
            business.growth * 0.3 +
            (business.aiIntegration || 0) * 0.3),
        0
      ) / aiBusinesses.length
    );
  }

  private assessComputationalResources(districtId: string): number {
    const businesses = Array.from(this.businesses.values()).filter(
      (b) => b.districtId === districtId
    );

    return (
      businesses.reduce((sum, b) => sum + (b.dataUtilization || 0), 0) /
      Math.max(businesses.length, 1)
    );
  }

  private evaluateDataMarket(districtId: string): number {
    const dataBusinesses = Array.from(this.businesses.values()).filter(
      (b) => b.districtId === districtId && b.type === "data_processing"
    );

    return (
      dataBusinesses.reduce((sum, b) => sum + b.revenue, 0) /
      Math.max(dataBusinesses.length, 1)
    );
  }

  async simulateMarket() {
    const districts = await this.districtService.getAllDistricts();

    for (const district of districts) {
      const metrics: MarketMetrics = {
        businessActivity: this.calculateBusinessActivity(district.id),
        jobMarket: this.calculateJobMarket(district.id),
        propertyValues: this.calculatePropertyValues(district.id),
        investmentFlow: this.calculateInvestmentFlow(district.id),
        consumerConfidence: this.calculateConsumerConfidence(district.id),
      };

      this.marketMetrics.set(district.id, metrics);
      this.emit("marketUpdated", { districtId: district.id, metrics });
    }
  }

  private calculateBusinessActivity(districtId: string): number {
    const businesses = Array.from(this.businesses.values()).filter(
      (b) => b.districtId === districtId
    );

    return (
      businesses.reduce(
        (acc, b) =>
          acc + (b.revenue * 0.3 + b.employment * 0.3 + b.growth * 0.4),
        0
      ) / Math.max(businesses.length, 1)
    );
  }

  private calculateJobMarket(districtId: string): number {
    const jobMarket = this.jobMarkets.get(districtId);
    if (!jobMarket) return 0.5;

    return (
      jobMarket.employmentRate * 0.4 +
      jobMarket.jobCreationRate * 0.3 +
      (jobMarket.openPositions / 100) * 0.3
    );
  }

  private calculatePropertyValues(districtId: string): number {
    const market = this.propertyMarkets.get(districtId);
    if (!market) return 0.5;

    return (
      market.residentialValue * 0.4 +
      market.commercialValue * 0.4 +
      market.developmentPotential * 0.2
    );
  }

  private calculateInvestmentFlow(districtId: string): number {
    const districtInvestments = Array.from(this.investments.values()).filter(
      (i) => i.districtId === districtId
    );

    return (
      districtInvestments.reduce(
        (acc, i) =>
          acc +
          (i.amount * 0.4 + i.expectedReturn * 0.3 + i.culturalValue * 0.3),
        0
      ) / Math.max(districtInvestments.length, 1)
    );
  }

  private calculateConsumerConfidence(districtId: string): number {
    const metrics = this.marketMetrics.get(districtId);
    if (!metrics) return 0.5;

    return (
      metrics.businessActivity * 0.3 +
      metrics.jobMarket * 0.3 +
      metrics.propertyValues * 0.2 +
      metrics.investmentFlow * 0.2
    );
  }

  private async updateEconomicIndicators() {
    const allMetrics = Array.from(this.marketMetrics.values());

    this.economicIndicators = {
      gdp: this.calculateGDP(allMetrics),
      inflation: this.calculateInflation(),
      unemployment: this.calculateUnemployment(),
      economicGrowth: this.calculateEconomicGrowth(),
      marketStability: this.calculateMarketStability(allMetrics),
    };

    this.emit("economicIndicatorsUpdated", this.economicIndicators);
  }

  private calculateGDP(metrics: MarketMetrics[]): number {
    return (
      metrics.reduce(
        (acc, m) => acc + m.businessActivity + m.investmentFlow,
        0
      ) *
      (1 + this.economicIndicators.economicGrowth)
    );
  }

  private calculateInflation(): number {
    const baseInflation = 0.02;
    const marketPressure =
      Array.from(this.marketMetrics.values()).reduce(
        (acc, m) => acc + m.consumerConfidence,
        0
      ) / this.marketMetrics.size;

    return baseInflation * (1 + marketPressure);
  }

  private calculateUnemployment(): number {
    const totalJobs = Array.from(this.jobMarkets.values()).reduce(
      (acc, j) => acc + j.openPositions,
      0
    );
    const totalEmployed = Array.from(this.jobMarkets.values()).reduce(
      (acc, j) => acc + j.employmentRate * 100,
      0
    );

    return Math.max(0, (totalJobs - totalEmployed) / totalJobs);
  }

  private calculateEconomicGrowth(): number {
    return (
      this.calculateAverageBusinessGrowth() * 0.4 +
      this.calculateInvestmentGrowth() * 0.3 +
      (1 - this.economicIndicators.unemployment) * 0.3
    );
  }

  private calculateMarketStability(metrics: MarketMetrics[]): number {
    const volatility =
      metrics.reduce(
        (acc, m) => acc + Math.abs(m.businessActivity - m.consumerConfidence),
        0
      ) / metrics.length;

    return Math.max(0, 1 - volatility);
  }

  private calculateAverageBusinessGrowth(): number {
    const businesses = Array.from(this.businesses.values());
    return (
      businesses.reduce((acc, b) => acc + b.growth, 0) /
      Math.max(businesses.length, 1)
    );
  }

  private calculateInvestmentGrowth(): number {
    return (
      Array.from(this.investments.values()).reduce(
        (acc, i) => acc + i.expectedReturn,
        0
      ) / Math.max(this.investments.size, 1)
    );
  }

  private async processInvestments() {
    for (const investment of this.investments.values()) {
      const return_rate = this.calculateInvestmentReturn(investment);
      const cultural_impact = this.calculateCulturalImpact(investment);

      // Store investment performance in vector store for analysis
      await this.vectorStore.upsert({
        id: `investment-${investment.id}`,
        values: await this.vectorStore.createEmbedding(
          `Investment in ${investment.type} with return rate ${return_rate} and cultural impact ${cultural_impact}`
        ),
        metadata: {
          type: "district",
          investmentId: investment.id,
          investmentType: investment.type,
          districtId: investment.districtId,
          return_rate,
          cultural_impact,
          timestamp: Date.now(),
        },
      });

      this.emit("investmentProcessed", {
        investmentId: investment.id,
        return_rate,
        cultural_impact,
      });
    }
  }

  private calculateInvestmentReturn(investment: Investment): number {
    const marketMetrics = this.marketMetrics.get(investment.districtId);
    if (!marketMetrics) return 0;

    const aiBonus = (marketMetrics.aiEconomicActivity || 0) * 0.2;

    return (
      investment.expectedReturn * 0.3 +
      marketMetrics.businessActivity * 0.2 +
      marketMetrics.consumerConfidence * 0.2 +
      aiBonus +
      (marketMetrics.dataMarketMetrics || 0) * 0.1
    );
  }

  private calculateCulturalImpact(investment: Investment): number {
    const aiEnhancement = investment.type === "technology" ? 0.2 : 0;
    return (
      investment.culturalValue * 0.5 +
      investment.socialImpact * 0.3 +
      aiEnhancement
    );
  }

  private async calculateDataMarketValue(districtId: string): Promise<number> {
    const dataBusinesses = Array.from(this.businesses.values()).filter(
      (b) => b.districtId === districtId && b.type === "data_processing"
    );

    const baseValue = dataBusinesses.reduce((sum, b) => sum + b.revenue, 0);
    const growthFactor =
      dataBusinesses.reduce((sum, b) => sum + b.growth, 0) /
      Math.max(dataBusinesses.length, 1);

    return baseValue * (1 + growthFactor);
  }

  private async assessDataTrading(districtId: string): Promise<number> {
    const businesses = Array.from(this.businesses.values()).filter(
      (b) => b.districtId === districtId
    );

    return (
      businesses.reduce((sum, b) => sum + (b.dataUtilization || 0), 0) /
      Math.max(businesses.length, 1)
    );
  }

  private async measureDataUtilization(districtId: string): Promise<number> {
    const businesses = Array.from(this.businesses.values()).filter(
      (b) => b.districtId === districtId
    );

    const totalUtilization = businesses.reduce(
      (sum, b) => sum + (b.dataUtilization || 0),
      0
    );
    const efficiency =
      businesses.reduce((sum, b) => sum + b.stability, 0) /
      Math.max(businesses.length, 1);

    return totalUtilization * efficiency;
  }

  private calculateInnovationIndex(aiBusinesses: BusinessActivity[]): number {
    if (!aiBusinesses.length) return 0;

    return (
      aiBusinesses.reduce(
        (sum, business) =>
          sum +
          (business.growth * 0.3 +
            (business.aiIntegration || 0) * 0.4 +
            business.stability * 0.3),
        0
      ) / aiBusinesses.length
    );
  }

  private assessDigitalTransformation(): number {
    const allBusinesses = Array.from(this.businesses.values());
    const aiBusinesses = allBusinesses.filter(
      (b) => b.type === "ai_services" || b.type === "data_processing"
    );

    const aiRevenue = aiBusinesses.reduce((sum, b) => sum + b.revenue, 0);
    const totalRevenue = allBusinesses.reduce((sum, b) => sum + b.revenue, 0);

    return aiRevenue / Math.max(totalRevenue, 1);
  }

  // Public API methods
  async getMarketMetrics(
    districtId: string
  ): Promise<MarketMetrics | undefined> {
    return this.marketMetrics.get(districtId);
  }

  async getAIEconomicMetrics(districtId: string) {
    const metrics = this.marketMetrics.get(districtId);
    return {
      aiEconomicActivity: metrics?.aiEconomicActivity || 0,
      computationalResources: metrics?.computationalResources || 0,
      dataMarketMetrics: metrics?.dataMarketMetrics || 0,
    };
  }

  async getDataMarketMetrics(districtId: string) {
    const dataMarketValue = await this.calculateDataMarketValue(districtId);
    const dataTrading = await this.assessDataTrading(districtId);
    const dataUtilization = await this.measureDataUtilization(districtId);
    return { dataMarketValue, dataTrading, dataUtilization };
  }

  async getInnovationMetrics() {
    return {
      innovationIndex: this.economicIndicators.innovationIndex,
      digitalTransformation: this.economicIndicators.digitalTransformation,
    };
  }

  async getDigitalTransformationMetrics() {
    const allBusinesses = Array.from(this.businesses.values());
    const aiBusinesses = allBusinesses.filter(
      (b) => b.type === "ai_services" || b.type === "data_processing"
    );

    return {
      transformationRate: this.economicIndicators.digitalTransformation,
      aiBusinessCount: aiBusinesses.length,
      totalBusinessCount: allBusinesses.length,
      aiRevenue: aiBusinesses.reduce((sum, b) => sum + b.revenue, 0),
      totalRevenue: allBusinesses.reduce((sum, b) => sum + b.revenue, 0),
    };
  }

  async getEconomicIndicators(): Promise<EconomicIndicators> {
    return this.economicIndicators;
  }

  async addBusiness(business: BusinessActivity): Promise<void> {
    this.businesses.set(business.id, business);
    this.emit("businessAdded", business);
  }

  async updatePropertyMarket(market: PropertyMarket): Promise<void> {
    this.propertyMarkets.set(market.districtId, market);
    this.emit("propertyMarketUpdated", market);
  }

  async updateJobMarket(market: JobMarket): Promise<void> {
    this.jobMarkets.set(market.districtId, market);
    this.emit("jobMarketUpdated", market);
  }

  async addInvestment(investment: Investment): Promise<void> {
    this.investments.set(investment.id, investment);
    this.emit("investmentAdded", investment);
  }
}
