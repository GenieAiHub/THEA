import type { LlmMessageRole } from './llmMessageRole';
export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}
