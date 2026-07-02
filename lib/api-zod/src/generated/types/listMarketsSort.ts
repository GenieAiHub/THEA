export type ListMarketsSort = typeof ListMarketsSort[keyof typeof ListMarketsSort];
export const ListMarketsSort = {
  trending: 'trending',
  newest: 'newest',
  closing: 'closing',
} as const;
