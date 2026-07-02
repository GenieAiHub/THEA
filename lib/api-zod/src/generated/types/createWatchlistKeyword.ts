import type { CreateWatchlistKeywordType } from './createWatchlistKeywordType';
export interface CreateWatchlistKeyword {
  keyword: string;
  type?: CreateWatchlistKeywordType;
  category?: string;
  notes?: string;
}
