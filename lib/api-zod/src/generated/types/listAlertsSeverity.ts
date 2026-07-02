export type ListAlertsSeverity = typeof ListAlertsSeverity[keyof typeof ListAlertsSeverity];
export const ListAlertsSeverity = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
} as const;
