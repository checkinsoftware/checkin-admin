import { Pool } from "pg";

// Cache the pool across hot reloads / warm serverless invocations.
const globalForDb = globalThis as unknown as { pool?: Pool };

// DATABASE_URL on Vercel/Neon-marketplace; NETLIFY_DB_URL is what Netlify's
// own Postgres extension (@netlify/database) auto-provisions on deploy.
function connectionString() {
  return process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
}

export function hasDatabase() {
  return Boolean(connectionString());
}

export function getPool(): Pool {
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL is not set");

  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({
      connectionString: url,
      // Neon / Vercel Postgres / Supabase all terminate TLS at the pooler.
      ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForDb.pool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
