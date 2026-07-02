export type CreateWatchlistKeywordType = typeof CreateWatchlistKeywordType[keyof typeof CreateWatchlistKeywordType];
export const CreateWatchlistKeywordType = {
  keyword: 'keyword',
  brand: 'brand',
  person: 'person',
  competitor: 'competitor',
} as const;
