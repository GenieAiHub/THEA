import type { Market } from './market';
export interface MarketGenerationResult {
  generated: number;
  markets: Market[];
  message?: string;
}
