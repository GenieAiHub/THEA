export type TalkingPointsInputProvider = typeof TalkingPointsInputProvider[keyof typeof TalkingPointsInputProvider];
export const TalkingPointsInputProvider = {
  openai: 'openai',
  gemini: 'gemini',
} as const;
