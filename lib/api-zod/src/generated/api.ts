import * as z from 'zod';

const marketOptionSchema = z.object({
  label: z.string(),
  votes: z.number(),
  percentage: z.number(),
});

const configItemSchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  category: z.string().optional(),
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  isSecret: z.boolean().optional(),
  isActive: z.boolean().optional(),
  hasValue: z.boolean().optional(),
  value: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

const marketSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  options: z.array(marketOptionSchema),
  totalVotes: z.number(),
  status: z.enum(['open', 'closed', 'resolved']),
  resolvedOption: z.number().nullable().optional(),
  source: z.enum(['auto', 'manual']).optional(),
  sourceTopic: z.string().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
});

export const HealthCheckResponse = z.object({
  status: z.string(),
});

export const HealthCheckV1Response = z.object({
  status: z.enum(['ok', 'degraded']),
  services: z.object({
    database: z.string().optional(),
    redis: z.string().optional(),
    elasticsearch: z.string().optional(),
  }),
  version: z.string().optional(),
  timestamp: z.coerce.date(),
});

export const listContentQueryPageDefault = 1;
export const listContentQueryLimitDefault = 50;
export const listContentQueryLimitMax = 100;

export const ListContentQueryParams = z.object({
  platform: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(listContentQueryPageDefault),
  limit: z.coerce.number().default(listContentQueryLimitDefault),
});

export const ListContentResponse = z.object({
  data: z.array(z.object({
    id: z.string().optional(),
    platform: z.string().optional(),
    title: z.string().nullable().optional(),
    body: z.string().optional(),
    author: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    sentimentScore: z.number().nullable().optional(),
    sourceUrl: z.string().nullable().optional(),
    geoCountry: z.string().nullable().optional(),
    collectedAt: z.coerce.date().optional(),
  })).optional(),
  pagination: z.object({
    page: z.number().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }).optional(),
});

export const GetContentItemParams = z.object({
  id: z.string(),
});

export const GetContentItemResponse = z.object({
  id: z.string().optional(),
  platform: z.string().optional(),
  title: z.string().nullable().optional(),
  body: z.string().optional(),
  author: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sentimentScore: z.number().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  geoCountry: z.string().nullable().optional(),
  collectedAt: z.coerce.date().optional(),
});

export const listTrendsQueryTimeframeDefault = '24h';
export const listTrendsQueryLimitDefault = 20;
export const listTrendsQueryLimitMax = 100;

export const ListTrendsQueryParams = z.object({
  category: z.string().optional(),
  timeframe: z.enum(['24h', '7d', '30d']).default('24h'),
  limit: z.coerce.number().default(listTrendsQueryLimitDefault),
});

export const ListTrendsResponse = z.object({
  data: z.array(z.object({
    id: z.string().optional(),
    topic: z.string().optional(),
    category: z.string().optional(),
    score: z.number().optional(),
    lifecycleStage: z.string().nullable().optional(),
    mentionCount: z.number().nullable().optional(),
    sentimentAvg: z.number().nullable().optional(),
    scoredAt: z.coerce.date().optional(),
  })).optional(),
  timeframe: z.string().optional(),
});

export const ListCategoriesResponse = z.object({
  data: z.array(z.string()).optional(),
});

export const GetTrendHistoryParams = z.object({
  topic: z.string(),
});

export const GetTrendHistoryResponse = z.unknown();

export const GetLatestAnalysisResponse = z.object({
  data: z.array(z.object({
    id: z.string().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
    narrativeSummary: z.string().nullable().optional(),
    sentimentOverall: z.string().nullable().optional(),
    itemsAnalyzed: z.number().nullable().optional(),
    runAt: z.coerce.date().optional(),
  })).optional(),
});

export const getAnalysisHistoryQueryLimitDefault = 50;

export const GetAnalysisHistoryQueryParams = z.object({
  category: z.string().optional(),
  limit: z.coerce.number().default(getAnalysisHistoryQueryLimitDefault),
});

export const GetAnalysisHistoryResponse = z.unknown();

export const GetCategoryAnalysisParams = z.object({
  category: z.string(),
});

export const GetCategoryAnalysisResponse = z.unknown();

export const TriggerAnalysisRunBody = z.object({
  category: z.string().optional(),
});

export const TriggerAnalysisRunResponse = z.void();

export const ListWatchlistKeywordsResponse = z.unknown();

export const CreateWatchlistKeywordBody = z.object({
  keyword: z.string(),
  type: z.enum(['keyword', 'brand', 'person', 'competitor']).optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateWatchlistKeywordResponse = z.void();

export const UpdateWatchlistKeywordParams = z.object({
  id: z.string(),
});

export const UpdateWatchlistKeywordResponse = z.unknown();

export const DeleteWatchlistKeywordParams = z.object({
  id: z.string(),
});

export const DeleteWatchlistKeywordResponse = z.void();

export const listAlertsQueryLimitDefault = 50;

export const ListAlertsQueryParams = z.object({
  status: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.coerce.number().default(listAlertsQueryLimitDefault),
});

export const ListAlertsResponse = z.unknown();

export const GetAlertParams = z.object({
  id: z.string(),
});

export const GetAlertResponse = z.unknown();

export const ResolveAlertParams = z.object({
  id: z.string(),
});

export const ResolveAlertResponse = z.unknown();

export const ListCrawlerSourcesResponse = z.unknown();

export const CreateCrawlerSourceBody = z.object({
  name: z.string(),
  url: z.string(),
  type: z.enum(['rss', 'crawl', 'api']).optional(),
  category: z.string(),
  language: z.string().optional(),
  country: z.string().optional(),
});

export const CreateCrawlerSourceResponse = z.void();

export const UpdateCrawlerSourceParams = z.object({
  id: z.string(),
});

export const UpdateCrawlerSourceResponse = z.unknown();

export const DeleteCrawlerSourceParams = z.object({
  id: z.string(),
});

export const DeleteCrawlerSourceResponse = z.void();

export const listCollectionRunsQueryLimitDefault = 50;

export const ListCollectionRunsQueryParams = z.object({
  limit: z.coerce.number().default(listCollectionRunsQueryLimitDefault),
});

export const ListCollectionRunsResponse = z.unknown();

export const ListWebhooksResponse = z.unknown();

export const CreateWebhookBody = z.object({
  url: z.string(),
  events: z.array(z.string()).optional(),
});

export const CreateWebhookResponse = z.void();

export const DeleteWebhookParams = z.object({
  id: z.string(),
});

export const DeleteWebhookResponse = z.void();

export const llmChatBodyProviderDefault = 'openai';

export const LlmChatBody = z.object({
  provider: z.enum(['openai', 'gemini']).default('openai'),
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
});

export const LlmChatResponse = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  content: z.string().optional(),
  usage: z.object({
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).optional(),
  durationMs: z.number().optional(),
});

export const GenerateTalkingPointsBody = z.object({
  topic: z.string(),
  context: z.string().optional(),
  provider: z.enum(['openai', 'gemini']).optional(),
});

export const GenerateTalkingPointsResponse = z.object({
  topic: z.string().optional(),
  talkingPoints: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

export const DraftStatementBody = z.object({
  topic: z.string(),
  tone: z.string().optional(),
  audience: z.string().optional(),
  provider: z.enum(['openai', 'gemini']).optional(),
});

export const DraftStatementResponse = z.object({
  topic: z.string().optional(),
  statement: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

export const AdminListConfigsResponse = z.object({
  data: z.array(configItemSchema).optional(),
});

export const AdminBulkUpsertConfigsBody = z.object({
  items: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })),
});

export const AdminBulkUpsertConfigsResponse = z.unknown();

export const AdminGetConfigParams = z.object({
  key: z.string(),
});

export const AdminGetConfigResponse = configItemSchema;

export const AdminUpsertConfigParams = z.object({
  key: z.string(),
});

export const AdminUpsertConfigBody = z.object({
  value: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  isSecret: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const AdminUpsertConfigResponse = configItemSchema;

export const AdminDeleteConfigParams = z.object({
  key: z.string(),
});

export const AdminDeleteConfigResponse = z.void();

export const AdminListOrgsResponse = z.unknown();

export const AdminListSubscriptionsResponse = z.unknown();

export const AdminGetLlmUsageResponse = z.unknown();

export const AdminGetStatsResponse = z.unknown();

export const GeneratePdfReportResponse = z.void();

export const RunWhatIfSimulationResponse = z.void();

export const listMarketsQuerySortDefault = 'trending';
export const listMarketsQueryLimitDefault = 50;
export const listMarketsQueryLimitMax = 100;

export const ListMarketsQueryParams = z.object({
  status: z.enum(['open', 'closed', 'resolved']).optional(),
  category: z.string().optional(),
  sort: z.enum(['trending', 'newest', 'closing']).default('trending'),
  search: z.string().optional(),
  limit: z.coerce.number().default(listMarketsQueryLimitDefault),
});

export const ListMarketsResponse = z.object({
  data: z.array(marketSchema),
});

export const ListMarketCategoriesResponse = z.object({
  data: z.array(z.object({
    category: z.string(),
    count: z.number(),
  })).optional(),
});

export const GetMarketStatsResponse = z.object({
  totalMarkets: z.number(),
  openMarkets: z.number(),
  totalVotes: z.number(),
  categories: z.number(),
});

export const GetMarketParams = z.object({
  id: z.string(),
});

export const GetMarketResponse = marketSchema;

export const VoteOnMarketParams = z.object({
  id: z.string(),
});

export const voteOnMarketBodyOptionIndexMin = 0;
export const voteOnMarketBodyVoterIdMin = 8;
export const voteOnMarketBodyVoterIdMax = 128;

export const VoteOnMarketBody = z.object({
  optionIndex: z.number().min(voteOnMarketBodyOptionIndexMin),
  voterId: z.string().min(voteOnMarketBodyVoterIdMin).max(voteOnMarketBodyVoterIdMax),
});

export const VoteOnMarketResponse = marketSchema;

export const AdminListMarketsResponse = z.object({
  data: z.array(marketSchema),
});

export const adminCreateMarketBodyOptionsMin = 2;
export const adminCreateMarketBodyOptionsMax = 6;

export const AdminCreateMarketBody = z.object({
  question: z.string(),
  description: z.string().optional(),
  category: z.string(),
  options: z.array(z.string()).min(adminCreateMarketBodyOptionsMin).max(adminCreateMarketBodyOptionsMax),
  closesAt: z.coerce.date().optional(),
});

export const AdminCreateMarketResponse = marketSchema;

export const AdminGenerateMarketsResponse = z.object({
  generated: z.number(),
  markets: z.array(marketSchema),
  message: z.string().optional(),
});

export const AdminUpdateMarketParams = z.object({
  id: z.string(),
});

export const adminUpdateMarketBodyResolvedOptionMin = 0;

export const AdminUpdateMarketBody = z.object({
  question: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['open', 'closed', 'resolved']).optional(),
  resolvedOption: z.number().min(adminUpdateMarketBodyResolvedOptionMin).optional(),
  closesAt: z.coerce.date().nullable().optional(),
});

export const AdminUpdateMarketResponse = marketSchema;

export const AdminDeleteMarketParams = z.object({
  id: z.string(),
});

export const AdminDeleteMarketResponse = z.void();

export const AdminGetMarketSettingsResponse = z.object({
  enabled: z.boolean(),
  frequencyMinutes: z.number(),
  topics: z.array(z.string()),
  marketsPerRun: z.number(),
  lastRunAt: z.coerce.date().nullable().optional(),
});

export const AdminUpdateMarketSettingsBody = z.object({
  enabled: z.boolean().optional(),
  frequencyMinutes: z.number().optional(),
  topics: z.array(z.string()).optional(),
  marketsPerRun: z.number().optional(),
});

export const AdminUpdateMarketSettingsResponse = z.object({
  enabled: z.boolean(),
  frequencyMinutes: z.number(),
  topics: z.array(z.string()),
  marketsPerRun: z.number(),
  lastRunAt: z.coerce.date().nullable().optional(),
});
