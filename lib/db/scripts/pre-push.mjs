/**
 * Pre-push script: ensures the pgvector extension is enabled in the database
 * before drizzle-kit push runs.  The extension must exist for the
 * `vector(1536)` column type in content_items to be recognised.
 *
 * Fails loudly if DATABASE_URL is not set so drizzle-kit gives a clear error.
 */
import pg from "pg";

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[pre-push] DATABASE_URL is not set — cannot enable pgvector");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });

try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("[pre-push] pgvector extension ensured");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("could not open extension control file")) {
    console.warn("[pre-push] pgvector not available on this database — continuing without it");
  } else {
    console.error("[pre-push] Failed to enable pgvector:", msg);
    process.exit(1);
  }
} finally {
  await pool.end();
}
