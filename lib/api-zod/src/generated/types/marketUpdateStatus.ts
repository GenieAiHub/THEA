export type MarketUpdateStatus = typeof MarketUpdateStatus[keyof typeof MarketUpdateStatus];
export const MarketUpdateStatus = {
  open: 'open',
  closed: 'closed',
  resolved: 'resolved',
} as const;
