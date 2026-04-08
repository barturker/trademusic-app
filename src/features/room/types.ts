import { z } from "zod";

import { RoomIdSchema, ParticipantSecretSchema } from "@/lib/validation-schemas";

import type { ParticipantRole, RoomStatus } from "@/types/room";

// Re-export shared schemas so existing room-feature imports still work
export { RoomIdSchema, ParticipantSecretSchema };

/** Database row type — defined manually to avoid coupling to server/schema. */
export interface RoomRow {
  id: string;
  status: RoomStatus;
  creatorSecretHash: string;
  joinerSecretHash: string | null;
  inviteTokenHash: string;
  inviteUsed: boolean;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  joinedAt: Date | null;
  creatorApprovedAt: Date | null;
  joinerApprovedAt: Date | null;
  cancellationReason: string | null;
  cancelledBy: ParticipantRole | null;
  cancelledAt: Date | null;
}

// --- Validation schemas ---

const TOKEN_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]+$/;
const MAX_REASON_LENGTH = 500;

/** Hex-string validator for invite tokens. */
function hexString(length: number, label: string) {
  return z
    .string()
    .length(length, `${label} must be ${length} characters`)
    .regex(HEX_PATTERN, `${label} must be lowercase hex`);
}

export const InviteTokenSchema = hexString(TOKEN_LENGTH, "Invite token");

export const CancellationReasonSchema = z
  .string()
  .max(MAX_REASON_LENGTH, `Reason must be at most ${MAX_REASON_LENGTH} characters`)
  .optional();

/** Zod schema for join room input. */
export const JoinRoomInput = z.object({
  roomId: RoomIdSchema,
  inviteToken: InviteTokenSchema,
});

export type JoinRoomInput = z.infer<typeof JoinRoomInput>;

// --- Timeline types ---

export const TIMELINE_EVENT_TYPES = [
  "room_created",
  "participant_joined",
  "track_uploaded",
  "analysis_completed",
  "analysis_failed",
  "creator_approved",
  "joiner_approved",
  "room_completed",
  "room_cancelled",
  "room_expired",
  "download_granted",
  "track_downloaded",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  label: string;
  timestamp: string;
  role?: ParticipantRole;
  metadata?: Record<string, string>;
}
