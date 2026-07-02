export type DetailedHealthStatusStatus = typeof DetailedHealthStatusStatus[keyof typeof DetailedHealthStatusStatus];
export const DetailedHealthStatusStatus = {
  ok: 'ok',
  degraded: 'degraded',
} as const;
