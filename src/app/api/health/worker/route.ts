import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { pool } from "@/server/db";

const QUEUE_NAME = "track-analysis";
const QUEUE_HEALTHY_THRESHOLD = 10;
const RECENT_WARNINGS_LIMIT = 20;
const HEALTH_SECRET = process.env.HEALTH_SECRET ?? "";

function isValidSecret(input: string): boolean {
  if (!HEALTH_SECRET || !input) return false;
  const secret = Buffer.from(HEALTH_SECRET);
  const provided = Buffer.from(input);
  if (secret.length !== provided.length) return false;
  return timingSafeEqual(secret, provided);
}

interface QueueStats {
  queuedCount: number;
  activeCount: number;
  totalCount: number;
  warningQueueSize: number | null;
}

interface RoomStats {
  processingRooms: number;
  pendingTracks: number;
  processingTracks: number;
  failedTracks: number;
}

interface WarningEntry {
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  createdOn: string;
}

interface WorkerHealth {
  status: "healthy" | "busy" | "overloaded";
  timestamp: string;
  queue: QueueStats;
  rooms: RoomStats;
  recentWarnings: WarningEntry[];
  message: string;
}

export async function GET(request: NextRequest) {
  if (!isValidSecret(request.nextUrl.searchParams.get("key") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  try {
    const client = await pool.connect();

    try {
      const [queueResult, roomResult, trackResult, warningResult] = await Promise.all([
        client.query<{
          queuedCount: string;
          activeCount: string;
          totalCount: string;
          warningQueueSize: string | null;
        }>(
          `SELECT
            queued_count as "queuedCount",
            active_count as "activeCount",
            total_count as "totalCount",
            warning_queued as "warningQueueSize"
          FROM pgboss.queue
          WHERE name = $1`,
          [QUEUE_NAME],
        ),
        client.query<{ count: string }>(
          `SELECT count(*)::text as count FROM rooms WHERE status = 'processing'`,
        ),
        client.query<{ status: string; count: string }>(
          `SELECT processing_status as status, count(*)::text as count
          FROM tracks
          WHERE processing_status IN ('pending', 'processing', 'failed')
          GROUP BY processing_status`,
        ),
        client.query<{
          type: string;
          message: string;
          data: Record<string, unknown> | null;
          created_on: Date;
        }>(
          `SELECT type, message, data, created_on
          FROM pgboss.warning
          ORDER BY created_on DESC
          LIMIT $1`,
          [RECENT_WARNINGS_LIMIT],
        ),
      ]);

      const queueRow = queueResult.rows[0];
      const queue: QueueStats = queueRow
        ? {
            queuedCount: parseInt(queueRow.queuedCount, 10),
            activeCount: parseInt(queueRow.activeCount, 10),
            totalCount: parseInt(queueRow.totalCount, 10),
            warningQueueSize: queueRow.warningQueueSize
              ? parseInt(queueRow.warningQueueSize, 10)
              : null,
          }
        : { queuedCount: 0, activeCount: 0, totalCount: 0, warningQueueSize: null };

      const processingRooms = parseInt(roomResult.rows[0]?.count ?? "0", 10);

      const trackCounts = new Map(trackResult.rows.map((r) => [r.status, parseInt(r.count, 10)]));
      const rooms: RoomStats = {
        processingRooms,
        pendingTracks: trackCounts.get("pending") ?? 0,
        processingTracks: trackCounts.get("processing") ?? 0,
        failedTracks: trackCounts.get("failed") ?? 0,
      };

      const recentWarnings: WarningEntry[] = warningResult.rows.map((r) => ({
        type: r.type,
        message: r.message,
        data: r.data,
        createdOn: r.created_on.toISOString(),
      }));

      const status =
        queue.queuedCount >= QUEUE_HEALTHY_THRESHOLD
          ? "overloaded"
          : queue.queuedCount > 0
            ? "busy"
            : "healthy";

      const message =
        status === "overloaded"
          ? `Queue backing up: ${queue.queuedCount} waiting. Consider scaling server or increasing CONCURRENCY.`
          : status === "busy"
            ? `${queue.queuedCount} tracks queued, ${queue.activeCount} processing.`
            : "All clear.";

      const result: WorkerHealth = { status, timestamp, queue, rooms, recentWarnings, message };

      return NextResponse.json(result);
    } finally {
      client.release();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("Worker health check failed", { error: errorMessage });

    return NextResponse.json(
      { status: "error", timestamp, message: "Health check failed" },
      { status: 503 },
    );
  }
}
