export interface TrendScore {
  id?: string;
  topic?: string;
  category?: string;
  score?: number;
  lifecycleStage?: string | null;
  mentionCount?: number | null;
  sentimentAvg?: number | null;
  scoredAt?: Date;
}
