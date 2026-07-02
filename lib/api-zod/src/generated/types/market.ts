import type { MarketOption } from './marketOption';
import type { MarketSource } from './marketSource';
import type { MarketStatus } from './marketStatus';
export interface Market {
  id: string;
  question: string;
  description?: string | null;
  category: string;
  options: MarketOption[];
  totalVotes: number;
  status: MarketStatus;
  resolvedOption?: number | null;
  source?: MarketSource;
  sourceTopic?: string | null;
  closesAt?: Date | null;
  createdAt: Date;
}
