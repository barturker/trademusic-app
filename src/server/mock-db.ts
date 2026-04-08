/**
 * In-memory mock database for development (Phase 2).
 * Replaced by real PostgreSQL + Drizzle in Phase 5.
 *
 * Uses globalThis to survive HMR reloads in dev.
 */

import type { InferSelectModel } from "drizzle-orm";
import type { rooms } from "./schema";

type RoomRow = InferSelectModel<typeof rooms>;

const globalForDb = globalThis as unknown as {
  mockRoomStore?: Map<string, RoomRow>;
};

const roomStore = globalForDb.mockRoomStore ?? (globalForDb.mockRoomStore = new Map<string, RoomRow>());

// --- Room CRUD ---

export function findRoomById(id: string): RoomRow | undefined {
  return roomStore.get(id);
}

export function findRoomByInviteTokenHash(tokenHash: string): RoomRow | undefined {
  for (const room of roomStore.values()) {
    if (room.inviteTokenHash === tokenHash) return room;
  }
  return undefined;
}

export function insertRoom(room: RoomRow): void {
  roomStore.set(room.id, { ...room });
}

export function updateRoom(id: string, data: Partial<RoomRow>): RoomRow | undefined {
  const existing = roomStore.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data };
  roomStore.set(id, updated);
  return updated;
}

export function deleteRoom(id: string): boolean {
  return roomStore.delete(id);
}

/** Debug helper — returns all rooms. */
export function getAllRooms(): RoomRow[] {
  return Array.from(roomStore.values());
}
