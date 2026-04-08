import { PgBoss } from "pg-boss";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const MAINTENANCE_INTERVAL_SECONDS = 120;

const globalForBoss = globalThis as unknown as {
  pgBoss?: PgBoss;
};

const DB_SSL = process.env.DB_SSL === "true";

function createBoss(): PgBoss {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    maintenanceIntervalSeconds: MAINTENANCE_INTERVAL_SECONDS,
    ...(DB_SSL && { ssl: { rejectUnauthorized: true } }),
  });

  boss.on("error", (err: Error) => {
    logger.error("pg-boss error", { message: err.message });
  });

  return boss;
}

export const boss = globalForBoss.pgBoss ?? (globalForBoss.pgBoss = createBoss());

/** Default queue options — completed jobs deleted after 4h, retained 24h. */
export const DEFAULT_QUEUE_OPTIONS = {
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 4 * 60 * 60,
  retryLimit: 3,
  retryBackoff: true,
  retryDelay: 30,
} as const;

const globalForStarted = globalThis as unknown as {
  pgBossStarted?: Promise<void>;
};

/** Ensure pg-boss is started (idempotent, safe to call multiple times). */
export async function ensureBossStarted(): Promise<void> {
  if (!globalForStarted.pgBossStarted) {
    globalForStarted.pgBossStarted = boss.start().then(() => {
      logger.info("pg-boss started (lazy)");
    });
  }
  await globalForStarted.pgBossStarted;
}

/** Gracefully stop pg-boss. */
export async function stopBoss(): Promise<void> {
  await boss.stop();
  logger.info("pg-boss stopped");
}
