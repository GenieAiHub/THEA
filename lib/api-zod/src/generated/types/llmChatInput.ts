import type { LlmChatInputProvider } from './llmChatInputProvider';
import type { LlmMessage } from './llmMessage';
export interface LlmChatInput {
  provider?: LlmChatInputProvider;
  model?: string;
  messages: LlmMessage[];
}
