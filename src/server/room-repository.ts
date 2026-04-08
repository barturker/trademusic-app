/**
 * Room repository — real PostgreSQL queries via Drizzle ORM.
 * Replaces mock-db.ts from Phase 2.
 *
 * Function signatures match mock-db for minimal migration effort.
 */

import { eq, and } from "drizzle-orm";

import { db } from "./db";
import { rooms } from "./schema";

import type { InferSelectModel } from "drizzle-orm";
import type { RoomStatus } from "@/types/room";

type RoomRow = InferSelectModel<typeof rooms>;

export async function findRoomById(id: string): Promise<RoomRow | undefined> {
  const result = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return result[0];
}

export async function findRoomByInviteTokenHash(tokenHash: string): Promise<RoomRow | undefined> {
  const result = await db.select().from(rooms).where(eq(rooms.inviteTokenHash, tokenHash)).limit(1);
  return result[0];
}

/** Alias for invite code hash lookup (same column, short code is hashed identically). */
export const findRoomByInviteCodeHash = findRoomByInviteTokenHash;

export async function insertRoom(room: RoomRow): Promise<void> {
  await db.insert(rooms).values(room);
}

export async function updateRoom(id: string, data: Partial<RoomRow>): Promise<RoomRow | undefined> {
  const result = await db.update(rooms).set(data).where(eq(rooms.id, id)).returning();
  return result[0];
}

export async function deleteRoom(id: string): Promise<boolean> {
  const result = await db.delete(rooms).where(eq(rooms.id, id)).returning();
  return result.length > 0;
}

/**
 * Atomically claim an invite — sets invite_used=true and joiner_secret_hash
 * only if invite_used is still false. Prevents double-join TOCTOU race.
 */
export async function claimInviteAtomic(
  id: string,
  data: Partial<RoomRow>,
): Promise<RoomRow | undefined> {
  const result = await db
    .update(rooms)
    .set(data)
    .where(
      and(
        eq(rooms.id, id),
        eq(rooms.inviteUsed, false),
      ),
    )
    .returning();
  return result[0];
}

/**
 * Atomically transition room status — updates only if current status matches
 * expectedStatus. Prevents approval/cancel TOCTOU race conditions.
 */
export async function transitionRoomStatusAtomic(
  id: string,
  expectedStatus: RoomStatus,
  data: Partial<RoomRow>,
): Promise<RoomRow | undefined> {
  const result = await db
    .update(rooms)
    .set(data)
    .where(
      and(
        eq(rooms.id, id),
        eq(rooms.status, expectedStatus),
      ),
    )
    .returning();
  return result[0];
}
