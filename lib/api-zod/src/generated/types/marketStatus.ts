export type MarketStatus = typeof MarketStatus[keyof typeof MarketStatus];
export const MarketStatus = {
  open: 'open',
  closed: 'closed',
  resolved: 'resolved',
} as const;
