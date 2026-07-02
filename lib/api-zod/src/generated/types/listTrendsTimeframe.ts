export type ListTrendsTimeframe = typeof ListTrendsTimeframe[keyof typeof ListTrendsTimeframe];
export const ListTrendsTimeframe = {
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
} as const;
