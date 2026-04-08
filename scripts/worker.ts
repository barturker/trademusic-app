/**
 * pg-boss worker — consumes track-analysis and cleanup jobs.
 *
 * Usage: pnpm worker
 *
 * Runs as a standalone process alongside Next.js.
 * Gracefully shuts down on SIGINT/SIGTERM.
 */

import { PgBoss } from "pg-boss";

import { logger } from "../src/lib/logger";
import { runAnalysisPipeline } from "../src/server/analysis/pipeline";
import { runCleanup } from "../src/server/cleanup/job";

const DATABASE_URL = process.env.DATABASE_URL ?? (() => { throw new Error("DATABASE_URL env var is required"); })();

const ANALYSIS_QUEUE = "track-analysis";
const CLEANUP_QUEUE = "file-cleanup";
const CLEANUP_CRON = "0 * * * *"; // Every hour
const CONCURRENCY = 2;
const QUEUE_WARNING_SIZE = 10;

interface AnalysisJobData {
  trackId: string;
  roomId: string;
}

async function main() {
  const boss = new PgBoss({ connectionString: DATABASE_URL });

  boss.on("error", (err: Error) => {
    logger.error("pg-boss error", { error: err.message });
  });

  boss.on("warning", (warning) => {
    logger.warn("pg-boss warning — queue may need scaling", {
      message: warning.message,
      ...warning.data,
    });
  });

  await boss.start();
  logger.info("pg-boss started", { queue: ANALYSIS_QUEUE, concurrency: CONCURRENCY });

  // Create queues (createQueue skips if exists, updateQueue syncs settings)
  await boss.createQueue(ANALYSIS_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 30,
    expireInSeconds: 600,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 4 * 60 * 60,
    warningQueueSize: QUEUE_WARNING_SIZE,
  });
  await boss.updateQueue(ANALYSIS_QUEUE, { warningQueueSize: QUEUE_WARNING_SIZE });

  await boss.createQueue(CLEANUP_QUEUE, {
    retryLimit: 1,
    expireInSeconds: 300,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 4 * 60 * 60,
  });

  // Schedule hourly cleanup
  await boss.schedule(CLEANUP_QUEUE, CLEANUP_CRON, {});
  logger.info("Cleanup scheduled", { cron: CLEANUP_CRON });

  // Analysis handler
  await boss.work<AnalysisJobData>(
    ANALYSIS_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      const { trackId, roomId } = job.data;

      const queue = await boss.getQueue(ANALYSIS_QUEUE);
      const queuedCount = queue?.queuedCount ?? 0;
      const activeCount = queue?.activeCount ?? 0;

      logger.info("Processing track", { trackId, roomId, queuedCount, activeCount });

      const start = performance.now();
      await runAnalysisPipeline(trackId, roomId);
      const elapsed = Math.round(performance.now() - start);

      logger.info("Track completed", { trackId, elapsedMs: elapsed });
    },
  );

  // Cleanup handler
  await boss.work(
    CLEANUP_QUEUE,
    { batchSize: 1 },
    async () => {
      logger.info("Running file cleanup");
      const start = performance.now();

      const result = await runCleanup(DATABASE_URL);

      const elapsed = Math.round(performance.now() - start);
      const totalCleaned = result.downloadedTracks + result.terminalRoomTracks;
      logger.info("Cleanup done", {
        elapsedMs: elapsed,
        staleExpiredRooms: result.staleExpiredRooms,
        grantExpiredRooms: result.grantExpiredRooms,
        totalCleaned,
        downloadedTracks: result.downloadedTracks,
        terminalRoomTracks: result.terminalRoomTracks,
      });
    },
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });
    await boss.stop({ graceful: true, timeout: 30_000 });
    logger.info("Worker stopped");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Worker fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
