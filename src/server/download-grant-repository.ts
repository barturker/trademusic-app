/**
 * Download grant repository — PostgreSQL queries via Drizzle ORM.
 */

import { eq, and } from "drizzle-orm";

import { db } from "./db";
import { downloadGrants } from "./schema";

import type { InferSelectModel } from "drizzle-orm";
import type { ParticipantRole } from "@/types/room";

type GrantRow = InferSelectModel<typeof downloadGrants>;

/** Extract the transaction type from db.transaction callback parameter. */
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Accepts either the db instance or a transaction — both share insert/update/select API. */
type DbClient = typeof db | TxClient;

export async function findGrantById(id: string): Promise<GrantRow | undefined> {
  const result = await db
    .select()
    .from(downloadGrants)
    .where(eq(downloadGrants.id, id))
    .limit(1);
  return result[0];
}

export async function findGrantForParticipant(
  roomId: string,
  role: ParticipantRole,
): Promise<GrantRow | undefined> {
  const result = await db
    .select()
    .from(downloadGrants)
    .where(and(eq(downloadGrants.roomId, roomId), eq(downloadGrants.participantRole, role)))
    .limit(1);
  return result[0];
}

export async function findGrantsForParticipant(
  roomId: string,
  role: ParticipantRole,
): Promise<GrantRow[]> {
  return db
    .select()
    .from(downloadGrants)
    .where(and(eq(downloadGrants.roomId, roomId), eq(downloadGrants.participantRole, role)));
}

export async function findAllGrantsByRoomId(roomId: string): Promise<GrantRow[]> {
  return db
    .select()
    .from(downloadGrants)
    .where(eq(downloadGrants.roomId, roomId));
}

/**
 * Insert a grant idempotently. Uses ON CONFLICT DO NOTHING on (room_id, track_id, participant_role)
 * so retries/duplicates are safely ignored. Accepts optional transaction context.
 */
export async function insertGrant(grant: GrantRow, tx?: DbClient): Promise<void> {
  const client = tx ?? db;
  await client.insert(downloadGrants).values(grant).onConflictDoNothing({
    target: [downloadGrants.roomId, downloadGrants.trackId, downloadGrants.participantRole],
  });
}

/**
 * Atomically mark a grant as used. Returns the grant if it was NOT already used,
 * or undefined if it was already consumed (prevents double-download race).
 */
export async function markGrantUsedAtomic(id: string): Promise<GrantRow | undefined> {
  const result = await db
    .update(downloadGrants)
    .set({
      downloaded: true,
      downloadedAt: new Date(),
      downloadCount: 1,
    })
    .where(
      and(
        eq(downloadGrants.id, id),
        eq(downloadGrants.downloaded, false),
      ),
    )
    .returning();
  return result[0];
}
