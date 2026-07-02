import type { DraftStatementInputProvider } from './draftStatementInputProvider';
export interface DraftStatementInput {
  topic: string;
  tone?: string;
  audience?: string;
  provider?: DraftStatementInputProvider;
}
