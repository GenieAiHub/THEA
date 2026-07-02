export interface ContentItem {
  id?: string;
  platform?: string;
  title?: string | null;
  body?: string;
  author?: string | null;
  language?: string | null;
  category?: string | null;
  sentimentScore?: number | null;
  sourceUrl?: string | null;
  geoCountry?: string | null;
  collectedAt?: Date;
}
