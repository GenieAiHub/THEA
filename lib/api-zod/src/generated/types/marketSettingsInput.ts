export interface MarketSettingsInput {
  enabled?: boolean;
  frequencyMinutes?: number;
  topics?: string[];
  marketsPerRun?: number;
}
