import { EventEmitter } from "events";
import { VectorStoreService } from "./vector-store.service";
import { DistrictService } from "./district.service";

interface MarketMetrics {
  businessActivity: number;
  jobMarket: number;
  propertyValues: number;
  investmentFlow: number;
  consumerConfidence: number;
}

interface EconomicIndicators {
  gdp: number;
  inflation: number;
  unemployment: number;
  economicGrowth: number;
  marketStability: number;
}

interface BusinessActivity {
  id: string;
  type: "retail" | "service" | "manufacturing" | "technology" | "cultural";
  districtId: string;
  revenue: number;
  employment: number;
  growth: number;
  stability: number;
  culturalImpact: number;
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
    gdp: 100,
    inflation: 0.02,
    unemployment: 0.05,
    economicGrowth: 0.03,
    marketStability: 0.8,
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
    this.initializeEconomicSimulation();
  }

  private initializeEconomicSimulation() {
    setInterval(() => this.simulateMarket(), 1000 * 60 * 15); // Every 15 minutes
    setInterval(() => this.updateEconomicIndicators(), 1000 * 60 * 60); // Hourly
    setInterval(() => this.processInvestments(), 1000 * 60 * 30); // Every 30 minutes
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

    return (
      investment.expectedReturn * 0.4 +
      marketMetrics.businessActivity * 0.3 +
      marketMetrics.consumerConfidence * 0.3
    );
  }

  private calculateCulturalImpact(investment: Investment): number {
    return investment.culturalValue * 0.6 + investment.socialImpact * 0.4;
  }

  // Public API methods
  async getMarketMetrics(
    districtId: string
  ): Promise<MarketMetrics | undefined> {
    return this.marketMetrics.get(districtId);
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
