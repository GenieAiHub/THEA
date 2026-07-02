export interface AnalysisReport {
  id?: string;
  category?: string;
  status?: string;
  narrativeSummary?: string | null;
  sentimentOverall?: string | null;
  itemsAnalyzed?: number | null;
  runAt?: Date;
}
