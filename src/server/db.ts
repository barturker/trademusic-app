import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import * as schema from "./schema";

const MAX_POOL_SIZE = 10;
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 5_000;

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

const DB_SSL = process.env.DB_SSL === "true";

function createPool(): Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: MAX_POOL_SIZE,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    ssl: DB_SSL ? { rejectUnauthorized: true } : undefined,
  });

  pool.on("error", (err) => {
    logger.error("Unexpected PostgreSQL pool error", {
      message: err.message,
    });
  });

  return pool;
}

export const pool = globalForDb.pgPool ?? (globalForDb.pgPool = createPool());

export const db = drizzle({ client: pool, schema });
