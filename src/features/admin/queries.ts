import { sql, eq, desc, count, gte } from "drizzle-orm";

import { db } from "@/server/db";
import { rooms, tracks, downloadGrants } from "@/server/schema";
import { ROOM_STATUSES } from "@/types/room";

import type {
  DashboardStats,
  StatusBreakdown,
  AdminRoomSummary,
  AdminRoomDetail,
  AdminTrackSummary,
  AdminGrantSummary,
} from "./types";

const RECENT_ROOMS_LIMIT = 50;

/** Build an empty status breakdown with all statuses set to 0. */
function emptyBreakdown(): StatusBreakdown {
  const breakdown = {} as StatusBreakdown;
  for (const status of ROOM_STATUSES) {
    breakdown[status] = 0;
  }
  return breakdown;
}

/** Get aggregate dashboard statistics. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    statusCounts,
    totalTracksResult,
    totalDownloadsResult,
    roomsLast24hResult,
    roomsLast7dResult,
    roomsLast30dResult,
    tracksProcessingResult,
    tracksFailedResult,
  ] = await Promise.all([
    // Room count by status
    db
      .select({ status: rooms.status, count: count() })
      .from(rooms)
      .groupBy(rooms.status),

    // Total tracks
    db.select({ value: count() }).from(tracks),

    // Total completed downloads
    db
      .select({ value: count() })
      .from(downloadGrants)
      .where(eq(downloadGrants.downloaded, true)),

    // Rooms created in last 24h
    db
      .select({ value: count() })
      .from(rooms)
      .where(gte(rooms.createdAt, oneDayAgo)),

    // Rooms created in last 7d
    db
      .select({ value: count() })
      .from(rooms)
      .where(gte(rooms.createdAt, sevenDaysAgo)),

    // Rooms created in last 30d
    db
      .select({ value: count() })
      .from(rooms)
      .where(gte(rooms.createdAt, thirtyDaysAgo)),

    // Tracks currently processing
    db
      .select({ value: count() })
      .from(tracks)
      .where(eq(tracks.processingStatus, "processing")),

    // Failed tracks
    db
      .select({ value: count() })
      .from(tracks)
      .where(eq(tracks.processingStatus, "failed")),
  ]);

  const breakdown = emptyBreakdown();
  let totalRooms = 0;
  for (const row of statusCounts) {
    breakdown[row.status] = row.count;
    totalRooms += row.count;
  }

  const ACTIVE_STATUSES = new Set([
    "created",
    "waiting_for_peer",
    "processing",
    "ready_for_review",
    "a_approved",
    "b_approved",
  ]);
  const activeRooms = statusCounts
    .filter((r) => ACTIVE_STATUSES.has(r.status))
    .reduce((sum, r) => sum + r.count, 0);

  return {
    totalRooms,
    activeRooms,
    totalTracks: totalTracksResult[0]?.value ?? 0,
    totalDownloads: totalDownloadsResult[0]?.value ?? 0,
    statusBreakdown: breakdown,
    roomsLast24h: roomsLast24hResult[0]?.value ?? 0,
    roomsLast7d: roomsLast7dResult[0]?.value ?? 0,
    roomsLast30d: roomsLast30dResult[0]?.value ?? 0,
    tracksProcessing: tracksProcessingResult[0]?.value ?? 0,
    tracksFailed: tracksFailedResult[0]?.value ?? 0,
  };
}

/** Get recent rooms with track and download counts for the activity table. */
export async function getRecentRooms(): Promise<AdminRoomSummary[]> {
  const rows = await db
    .select({
      id: rooms.id,
      status: rooms.status,
      createdAt: rooms.createdAt,
      joinedAt: rooms.joinedAt,
      completedAt: rooms.completedAt,
      trackCount: sql<number>`(
        SELECT COUNT(*)::int FROM tracks WHERE tracks.room_id = rooms.id
      )`,
      downloadCount: sql<number>`(
        SELECT COUNT(*)::int FROM download_grants
        WHERE download_grants.room_id = rooms.id AND download_grants.downloaded = true
      )`,
    })
    .from(rooms)
    .orderBy(desc(rooms.createdAt))
    .limit(RECENT_ROOMS_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    joinedAt: row.joinedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    trackCount: row.trackCount,
    downloadCount: row.downloadCount,
  }));
}

/** Get detailed room info for the admin room detail page. */
export async function getAdminRoomDetail(
  roomId: string,
): Promise<AdminRoomDetail | null> {
  const row = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  const room = row[0];
  if (!room) return null;

  const [roomTracks, roomGrants] = await Promise.all([
    db.select().from(tracks).where(eq(tracks.roomId, roomId)),
    db.select().from(downloadGrants).where(eq(downloadGrants.roomId, roomId)),
  ]);

  const trackSummaries: AdminTrackSummary[] = roomTracks.map((t) => ({
    id: t.id,
    role: t.role,
    originalFilename: t.originalFilename,
    fileSizeBytes: t.fileSizeBytes,
    mimeType: t.mimeType,
    durationSeconds: t.durationSeconds,
    bpm: t.bpm,
    processingStatus: t.processingStatus,
    processingError: t.processingError,
    uploadedAt: t.uploadedAt.toISOString(),
    processedAt: t.processedAt?.toISOString() ?? null,
  }));

  const grantSummaries: AdminGrantSummary[] = roomGrants.map((g) => ({
    id: g.id,
    trackId: g.trackId,
    participantRole: g.participantRole,
    downloaded: g.downloaded,
    downloadedAt: g.downloadedAt?.toISOString() ?? null,
    downloadCount: g.downloadCount,
    maxDownloads: g.maxDownloads,
    expiresAt: g.expiresAt.toISOString(),
    createdAt: g.createdAt.toISOString(),
  }));

  return {
    id: room.id,
    status: room.status,
    inviteUsed: room.inviteUsed,
    createdAt: room.createdAt.toISOString(),
    joinedAt: room.joinedAt?.toISOString() ?? null,
    completedAt: room.completedAt?.toISOString() ?? null,
    expiresAt: room.expiresAt?.toISOString() ?? null,
    creatorApprovedAt: room.creatorApprovedAt?.toISOString() ?? null,
    joinerApprovedAt: room.joinerApprovedAt?.toISOString() ?? null,
    cancellationReason: room.cancellationReason,
    cancelledBy: room.cancelledBy,
    cancelledAt: room.cancelledAt?.toISOString() ?? null,
    tracks: trackSummaries,
    grants: grantSummaries,
  };
}
