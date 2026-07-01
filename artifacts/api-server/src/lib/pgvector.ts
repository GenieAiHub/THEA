import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Ensures the pgvector extension exists and the HNSW ANN index on
 * content_items.embedding is in place.  Runs once at startup; safe to
 * call multiple times (all statements use IF NOT EXISTS).
 *
 * If the database does not support pgvector the error is logged and
 * the server continues — the embedding column simply won't have ANN
 * acceleration (exact KNN scan is still possible via the jsonb fallback
 * when the vector type is unavailable).
 */
export async function bootstrapPgVector(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    logger.info("pgvector extension enabled");

    await client.query(`
      CREATE INDEX IF NOT EXISTS content_items_embedding_hnsw_idx
      ON content_items
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    logger.info("content_items HNSW index ensured");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("could not open extension control file") || msg.includes("not supported")) {
      logger.warn("pgvector not available on this database — ANN index skipped; exact scan fallback active");
    } else {
      logger.error({ err }, "pgvector bootstrap error");
    }
  } finally {
    client.release();
  }
}
