import type { CreateCrawlerSourceType } from './createCrawlerSourceType';
export interface CreateCrawlerSource {
  name: string;
  url: string;
  type?: CreateCrawlerSourceType;
  category: string;
  language?: string;
  country?: string;
}
