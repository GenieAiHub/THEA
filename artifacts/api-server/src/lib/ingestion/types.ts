export interface NormalizedItem {
  platform: string;
  sourceUrl: string;
  title: string | null;
  body: string;
  author: string | null;
  publishedAt: Date | null;
  language: string;
  category: string;
  engagementMetrics: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    score?: number;
  };
  rawMetadata?: Record<string, unknown>;
}

export interface CollectorResult {
  sourceType: string;
  sourceId?: string;
  items: NormalizedItem[];
  errors?: string[];
}

export interface IngestionJobData {
  sourceType: string;
  sourceId?: string;
  category?: string;
  keyword?: string;
  urls?: string[];
  orgId?: string;
}
