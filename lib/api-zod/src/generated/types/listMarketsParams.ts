import type { ListMarketsSort } from './listMarketsSort';
import type { ListMarketsStatus } from './listMarketsStatus';
export type ListMarketsParams = {
  status?: ListMarketsStatus;
  category?: string;
  sort?: ListMarketsSort;
  search?: string;
  limit?: number;
};
