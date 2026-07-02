export type CreateCrawlerSourceType = typeof CreateCrawlerSourceType[keyof typeof CreateCrawlerSourceType];
export const CreateCrawlerSourceType = {
  rss: 'rss',
  crawl: 'crawl',
  api: 'api',
} as const;
