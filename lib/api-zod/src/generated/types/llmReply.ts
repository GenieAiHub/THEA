import type { LlmUsage } from './llmUsage';
export interface LlmReply {
  provider?: string;
  model?: string;
  content?: string;
  usage?: LlmUsage;
  durationMs?: number;
}
