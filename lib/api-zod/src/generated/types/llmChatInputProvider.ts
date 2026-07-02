export type LlmChatInputProvider = typeof LlmChatInputProvider[keyof typeof LlmChatInputProvider];
export const LlmChatInputProvider = {
  openai: 'openai',
  gemini: 'gemini',
} as const;
