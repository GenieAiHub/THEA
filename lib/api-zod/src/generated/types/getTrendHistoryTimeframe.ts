export type GetTrendHistoryTimeframe = typeof GetTrendHistoryTimeframe[keyof typeof GetTrendHistoryTimeframe];
export const GetTrendHistoryTimeframe = {
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
} as const;
