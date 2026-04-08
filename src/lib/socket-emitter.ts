/**
 * Server-side utility to notify the Socket.io server about room changes.
 *
 * Sends a POST to the Socket.io server's internal emit endpoint.
 * Non-blocking — failures are logged but never throw.
 */

import { createHmac } from "node:crypto";

import { logger } from "@/lib/logger";

const SOCKET_INTERNAL_URL =
  process.env.SOCKET_INTERNAL_URL ?? "http://localhost:3001/internal/emit";
const INTERNAL_SECRET = getInternalSecret();

function getInternalSecret(): string {
  const secret = process.env.SOCKET_INTERNAL_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SOCKET_INTERNAL_SECRET must be set in production");
  }
  return secret ?? "local-dev-internal-secret";
}

/** Notify all clients in a room that data has changed. */
export async function notifyRoom(roomId: string): Promise<void> {
  await emitToRoom(roomId, "room-updated", {});
}

/** Send analysis progress to all clients in a room. */
export async function notifyAnalysisProgress(
  roomId: string,
  trackId: string,
  step: string,
  progress: number,
): Promise<void> {
  await emitToRoom(roomId, "analysis-progress", { trackId, step, progress });
}

async function emitToRoom(
  roomId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const bodyStr = JSON.stringify({ roomId, event, data });
    const signature = createHmac("sha256", INTERNAL_SECRET).update(bodyStr).digest("hex");

    const res = await fetch(SOCKET_INTERNAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      logger.warn("Socket emit failed", { roomId, event, status: res.status });
    }
  } catch {
    // Socket server may not be running — non-critical
  }
}
