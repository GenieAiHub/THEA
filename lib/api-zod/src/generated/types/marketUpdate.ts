import type { MarketUpdateStatus } from './marketUpdateStatus';
export interface MarketUpdate {
  question?: string;
  description?: string;
  category?: string;
  status?: MarketUpdateStatus;
  resolvedOption?: number;
  closesAt?: Date | null;
}
