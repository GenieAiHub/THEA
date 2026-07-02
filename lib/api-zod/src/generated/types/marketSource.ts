export type MarketSource = typeof MarketSource[keyof typeof MarketSource];
export const MarketSource = {
  auto: 'auto',
  manual: 'manual',
} as const;
