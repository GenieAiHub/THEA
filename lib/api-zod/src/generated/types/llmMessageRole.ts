export type LlmMessageRole = typeof LlmMessageRole[keyof typeof LlmMessageRole];
export const LlmMessageRole = {
  user: 'user',
  assistant: 'assistant',
  system: 'system',
} as const;
