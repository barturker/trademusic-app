import { hashToken } from "@/lib/crypto";
import { createDownloadGrantToken } from "@/lib/download-grant-token";
import { env } from "@/lib/env";
import {
  findAllGrantsByRoomId,
  findGrantsForParticipant,
} from "@/server/download-grant-repository";
import { verifyParticipant } from "@/server/participant-verification";
import { findRoomById, findRoomByInviteTokenHash } from "@/server/room-repository";
import { findTracksByRoomId } from "@/server/track-repository";

import type { DownloadGrant, Room, Track, ParticipantRole } from "@/types/room";
import type { RoomRow } from "./types";

// Re-export so existing same-feature consumers don't break
export { verifyParticipant };

/** Map a database row to the domain Room type. Never exposes invite token (hashed in DB). */
function mapRow(row: RoomRow): Room {
  return {
    id: row.id,
    status: row.status,
    inviteToken: "",
    inviteUsed: row.inviteUsed,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    joinedAt: row.joinedAt?.toISOString() ?? null,
    creatorApprovedAt: row.creatorApprovedAt?.toISOString() ?? null,
    joinerApprovedAt: row.joinerApprovedAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    cancelledBy: row.cancelledBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

/** Get a room by ID, mapped to domain type. */
export async function getRoom(roomId: string): Promise<Room | null> {
  const row = await findRoomById(roomId);
  if (!row) return null;
  return mapRow(row);
}

/** Get a room by invite token hash (for join flow). */
export async function getRoomByInviteToken(token: string): Promise<Room | null> {
  const tokenHash = hashToken(token, env.SECRET_SALT);
  const row = await findRoomByInviteTokenHash(tokenHash);
  if (!row) return null;
  return mapRow(row);
}

/** Get all tracks for a room, mapped to domain types. */
export async function getTracksForRoom(roomId: string): Promise<Track[]> {
  const rows = await findTracksByRoomId(roomId);
  return rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    role: row.role,
    originalFilename: row.originalFilename,
    fileSizeBytes: row.fileSizeBytes,
    mimeType: row.mimeType,
    durationSeconds: row.durationSeconds,
    bitrateKbps: row.bitrateKbps,
    sampleRateHz: row.sampleRateHz,
    codec: row.codec,
    bpm: row.bpm,
    bpmConfidence: row.bpmConfidence,
    processingStatus: row.processingStatus,
    processingError: row.processingError ? "Analysis could not be completed" : null,
    uploadedAt: row.uploadedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  }));
}

/** Get download grants for a participant in a room. */
export async function getDownloadGrantsForParticipant(
  roomId: string,
  role: ParticipantRole,
): Promise<DownloadGrant[]> {
  const rows = await findGrantsForParticipant(roomId, role);
  return rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    trackId: row.trackId,
    participantRole: row.participantRole,
    token: createDownloadGrantToken(row.id, row.expiresAt),
    downloaded: row.downloaded,
    downloadedAt: row.downloadedAt?.toISOString() ?? null,
    downloadCount: row.downloadCount,
    maxDownloads: row.maxDownloads,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Check if all download grants in a room have been consumed or expired. */
export async function areAllDownloadsComplete(roomId: string): Promise<boolean> {
  const rows = await findAllGrantsByRoomId(roomId);
  if (rows.length === 0) return false;
  const now = new Date();
  return rows.every((g) => g.downloaded || g.expiresAt < now);
}
