export type DraftStatementInputProvider = typeof DraftStatementInputProvider[keyof typeof DraftStatementInputProvider];
export const DraftStatementInputProvider = {
  openai: 'openai',
  gemini: 'gemini',
} as const;
