/**
 * Track repository — PostgreSQL queries via Drizzle ORM.
 */

import { eq, and, count } from "drizzle-orm";

import { db } from "./db";
import { tracks } from "./schema";

import type { InferSelectModel } from "drizzle-orm";
import type { ParticipantRole } from "@/types/room";

type TrackRow = InferSelectModel<typeof tracks>;

export async function findTrackById(id: string): Promise<TrackRow | undefined> {
  const result = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
  return result[0];
}

export async function findTracksByRoomId(roomId: string): Promise<TrackRow[]> {
  return db.select().from(tracks).where(eq(tracks.roomId, roomId));
}

export async function findTrackByRoomAndRole(
  roomId: string,
  role: ParticipantRole,
): Promise<TrackRow | undefined> {
  const result = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.roomId, roomId), eq(tracks.role, role)))
    .limit(1);
  return result[0];
}

export async function countTracksByRoomAndRole(
  roomId: string,
  role: ParticipantRole,
): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(tracks)
    .where(and(eq(tracks.roomId, roomId), eq(tracks.role, role)));
  return result[0]?.value ?? 0;
}

export async function insertTrack(track: TrackRow): Promise<void> {
  await db.insert(tracks).values(track);
}

/**
 * Atomically check track count and insert if under the limit.
 * Uses SELECT ... FOR UPDATE to prevent TOCTOU race conditions.
 * Returns true if inserted, false if limit was reached.
 */
export async function insertTrackIfUnderLimit(
  track: TrackRow,
  maxTracks: number,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Lock existing rows for this room+role to prevent concurrent inserts
    const existing = await tx
      .select({ id: tracks.id })
      .from(tracks)
      .where(and(eq(tracks.roomId, track.roomId), eq(tracks.role, track.role)))
      .for("update");

    if (existing.length >= maxTracks) return false;

    await tx.insert(tracks).values(track);
    return true;
  });
}

export async function updateTrack(
  id: string,
  data: Partial<TrackRow>,
): Promise<TrackRow | undefined> {
  const result = await db.update(tracks).set(data).where(eq(tracks.id, id)).returning();
  return result[0];
}

export async function deleteTracksByRoomId(roomId: string): Promise<number> {
  const result = await db.delete(tracks).where(eq(tracks.roomId, roomId)).returning();
  return result.length;
}
