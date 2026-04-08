import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { pool } from "@/server/db";

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: {
    database: { status: "up" | "down"; latencyMs?: number; error?: string };
  };
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const checks: HealthStatus["checks"] = {
    database: { status: "down" },
  };

  // Database check
  const dbStart = performance.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      checks.database = {
        status: "up",
        latencyMs: Math.round(performance.now() - dbStart),
      };
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    checks.database = { status: "down" };
    logger.error("Health check: database down", { error: message });
  }

  const allUp = checks.database.status === "up";
  const result: HealthStatus = {
    status: allUp ? "healthy" : "unhealthy",
    timestamp,
    checks,
  };

  return NextResponse.json(result, { status: allUp ? 200 : 503 });
}
