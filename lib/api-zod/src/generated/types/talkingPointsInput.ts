import type { TalkingPointsInputProvider } from './talkingPointsInputProvider';
export interface TalkingPointsInput {
  topic: string;
  context?: string;
  provider?: TalkingPointsInputProvider;
}
