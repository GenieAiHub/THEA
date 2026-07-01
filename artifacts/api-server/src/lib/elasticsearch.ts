import { Client } from "@elastic/elasticsearch";
import { logger } from "./logger";

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;

let esClient: Client | null = null;

export const CONTENT_ITEMS_INDEX = "thea_content_items";

export function getElasticsearch(): Client {
  if (!esClient) {
    if (!ELASTICSEARCH_URL) {
      throw new Error("ELASTICSEARCH_URL environment variable is required");
    }
    esClient = new Client({
      node: ELASTICSEARCH_URL,
      requestTimeout: 10000,
      compression: true,
    });
  }
  return esClient;
}

export async function pingElasticsearch(): Promise<boolean> {
  try {
    if (!ELASTICSEARCH_URL) return false;
    const client = getElasticsearch();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

export async function ensureContentItemsIndex(): Promise<void> {
  const client = getElasticsearch();

  const exists = await client.indices.exists({ index: CONTENT_ITEMS_INDEX });
  if (exists) {
    logger.info({ index: CONTENT_ITEMS_INDEX }, "Elasticsearch index already exists");
    return;
  }

  await client.indices.create({
    index: CONTENT_ITEMS_INDEX,
    mappings: {
      properties: {
        id: { type: "keyword" },
        platform: { type: "keyword" },
        category: { type: "keyword" },
        language: { type: "keyword" },
        geoCountry: { type: "keyword" },
        geoRegion: { type: "keyword" },
        isDisinformation: { type: "keyword" },
        title: {
          type: "text",
          analyzer: "standard",
          fields: { keyword: { type: "keyword", ignore_above: 512 } },
        },
        body: { type: "text", analyzer: "standard" },
        author: { type: "text", fields: { keyword: { type: "keyword" } } },
        summary: { type: "text" },
        sentimentScore: { type: "float" },
        botRiskScore: { type: "float" },
        collectedAt: { type: "date" },
        publishedAt: { type: "date" },
        engagementMetrics: { type: "object", enabled: false },
        entities: { type: "nested" },
      },
    },
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      "index.max_result_window": 50000,
    },
  });

  logger.info({ index: CONTENT_ITEMS_INDEX }, "Elasticsearch index created");
}

export async function closeElasticsearch(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
  }
}
