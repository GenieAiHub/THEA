export interface MarketSettings {
  enabled: boolean;
  frequencyMinutes: number;
  topics: string[];
  marketsPerRun: number;
  lastRunAt?: Date | null;
}
