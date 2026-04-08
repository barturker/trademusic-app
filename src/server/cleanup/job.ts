/**
 * Cleanup job — expires stale and completed rooms, deletes orphaned files.
 *
 * Targets:
 * 0. Stale non-completed rooms past expiresAt → transition to "expired"
 * 1. Completed rooms with all grants consumed/expired → transition to "expired"
 * 2. Downloaded tracks (encrypted_dek IS NULL) — .enc + artifacts
 * 3. Terminal rooms (cancelled/expired/disputed) — all track files
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

import { and, eq, exists, gt, inArray, isNotNull, isNull, lt, not, notExists, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { downloadGrants, rooms, tracks } from "../schema";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./data/uploads";
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? "./data/artifacts";

const TERMINAL_STATUSES = ["cancelled", "expired", "disputed"] as const;

const SKIP_STATUSES = ["completed", "cancelled", "expired", "disputed"] as const;

interface CleanupResult {
  staleExpiredRooms: number;
  grantExpiredRooms: number;
  downloadedTracks: number;
  terminalRoomTracks: number;
}

export async function runCleanup(connectionString: string): Promise<CleanupResult> {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });

  let staleExpiredRooms = 0;
  let grantExpiredRooms = 0;
  let downloadedTracks = 0;
  let terminalRoomTracks = 0;

  try {
    const now = new Date();

    // 0. Auto-expire stale non-completed rooms past their expiresAt
    const staleResult = await db
      .update(rooms)
      .set({ status: "expired" })
      .where(
        and(
          notInArray(rooms.status, [...SKIP_STATUSES]),
          isNotNull(rooms.expiresAt),
          lt(rooms.expiresAt, now),
        ),
      )
      .returning({ id: rooms.id });

    staleExpiredRooms = staleResult.length;
    const staleExpiredIds = staleResult.map((r) => r.id);

    // 1. Auto-expire completed rooms where all grants are consumed or expired
    //    Single atomic query — no TOCTOU gap between grant check and status update
    const expiredResult = await db
      .update(rooms)
      .set({ status: "expired" })
      .where(
        and(
          eq(rooms.status, "completed"),
          // Room must have at least one grant (skip if grant creation still pending)
          exists(
            db
              .select({ id: downloadGrants.id })
              .from(downloadGrants)
              .where(eq(downloadGrants.roomId, rooms.id)),
          ),
          // No active grants remain (all are either downloaded or past expiry)
          notExists(
            db
              .select({ id: downloadGrants.id })
              .from(downloadGrants)
              .where(
                and(
                  eq(downloadGrants.roomId, rooms.id),
                  eq(downloadGrants.downloaded, false),
                  gt(downloadGrants.expiresAt, now),
                ),
              ),
          ),
        ),
      )
      .returning({ id: rooms.id });

    grantExpiredRooms = expiredResult.length;
    const newlyExpiredIds = [...staleExpiredIds, ...expiredResult.map((r) => r.id)];

    // 2. Downloaded tracks — DEK wiped, files are unrecoverable
    const orphanedTracks = await db
      .select({ id: tracks.id, storedFilename: tracks.storedFilename })
      .from(tracks)
      .where(and(isNull(tracks.encryptedDek), isNull(tracks.encryptionIv)));

    for (const track of orphanedTracks) {
      await safeRm(join(UPLOAD_DIR, track.storedFilename));
      await safeRm(join(ARTIFACTS_DIR, track.id), true);
      downloadedTracks++;
    }

    // 3. Terminal rooms — all files can go
    //    Skip rooms expired in THIS run to avoid racing with in-progress downloads.
    //    Their files will be cleaned up in the next hourly run.
    const terminalRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          inArray(rooms.status, [...TERMINAL_STATUSES]),
          newlyExpiredIds.length > 0 ? not(inArray(rooms.id, newlyExpiredIds)) : undefined,
        ),
      );

    for (const room of terminalRooms) {
      const roomTracks = await db
        .select({ id: tracks.id, storedFilename: tracks.storedFilename })
        .from(tracks)
        .where(eq(tracks.roomId, room.id));

      for (const track of roomTracks) {
        await safeRm(join(UPLOAD_DIR, track.storedFilename));
        await safeRm(join(ARTIFACTS_DIR, track.id), true);
        terminalRoomTracks++;
      }
    }
  } finally {
    await pool.end();
  }

  return { staleExpiredRooms, grantExpiredRooms, downloadedTracks, terminalRoomTracks };
}

async function safeRm(path: string, recursive = false): Promise<void> {
  try {
    await rm(path, { recursive, force: true });
  } catch {
    // File/dir may not exist, ignore
  }
}
