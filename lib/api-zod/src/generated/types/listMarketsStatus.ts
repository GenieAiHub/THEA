export type ListMarketsStatus = typeof ListMarketsStatus[keyof typeof ListMarketsStatus];
export const ListMarketsStatus = {
  open: 'open',
  closed: 'closed',
  resolved: 'resolved',
} as const;
