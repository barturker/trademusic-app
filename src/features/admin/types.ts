import type { SessionOptions } from "iron-session";

import type { RoomStatus, ProcessingStatus } from "@/types/room";

/** Counts of rooms grouped by status. */
export type StatusBreakdown = Record<RoomStatus, number>;

/** Aggregate stats for the admin dashboard. */
export interface DashboardStats {
  totalRooms: number;
  activeRooms: number;
  totalTracks: number;
  totalDownloads: number;
  statusBreakdown: StatusBreakdown;
  roomsLast24h: number;
  roomsLast7d: number;
  roomsLast30d: number;
  tracksProcessing: number;
  tracksFailed: number;
}

/** Lightweight room row for the activity table. */
export interface AdminRoomSummary {
  id: string;
  status: RoomStatus;
  createdAt: string;
  joinedAt: string | null;
  completedAt: string | null;
  trackCount: number;
  downloadCount: number;
}

/** Detailed room view for admin room detail page. */
export interface AdminRoomDetail {
  id: string;
  status: RoomStatus;
  inviteUsed: boolean;
  createdAt: string;
  joinedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  creatorApprovedAt: string | null;
  joinerApprovedAt: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  tracks: AdminTrackSummary[];
  grants: AdminGrantSummary[];
}

/** Track info visible to admin. */
export interface AdminTrackSummary {
  id: string;
  role: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number | null;
  bpm: number | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  uploadedAt: string;
  processedAt: string | null;
}

/** Download grant info visible to admin. */
export interface AdminGrantSummary {
  id: string;
  trackId: string | null;
  participantRole: string;
  downloaded: boolean;
  downloadedAt: string | null;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string;
  createdAt: string;
}

/** Session data stored in the encrypted iron-session cookie. */
export interface AdminSessionData {
  isAuthenticated?: boolean;
}

/** Cookie name for admin session. */
export const ADMIN_COOKIE_NAME = "ts_admin_session";

/** Cookie max age in seconds (24 hours). */
const ADMIN_COOKIE_MAX_AGE = 86400;

/** Rate limit: max login attempts per window. */
export const LOGIN_RATE_LIMIT = 5;

/** Rate limit: window duration in milliseconds (15 minutes). */
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

/** Build iron-session options at runtime (env is read lazily). */
export function getSessionOptions(): SessionOptions {
  return {
    password: process.env.IRON_SESSION_PASSWORD ?? "",
    cookieName: ADMIN_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: "/",
    },
  };
}
