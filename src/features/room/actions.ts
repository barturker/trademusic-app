"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { and, eq } from "drizzle-orm";

import { generateId } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { canTransition, transition } from "@/lib/room-machine";
import { notifyRoom } from "@/lib/socket-emitter";
import { db } from "@/server/db";
import { insertGrant } from "@/server/download-grant-repository";
import { findRoomById, transitionRoomStatusAtomic } from "@/server/room-repository";
import { rooms } from "@/server/schema";
import { findTracksByRoomId } from "@/server/track-repository";
import { verifyParticipant } from "./queries";
import { createRoomCore, joinRoomByCode, joinRoomCore } from "./lib/room-operations";
import {
  CancellationReasonSchema,
  InviteTokenSchema,
  ParticipantSecretSchema,
  RoomIdSchema,
} from "./types";

import type { ActionResult } from "@/types/actions";
import type { RoomRow } from "./types";

/** Extract the transaction type from db.transaction callback parameter. */
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CREATE_ROOM_RATE_LIMIT = 5;
const JOIN_ROOM_RATE_LIMIT = 10;
const APPROVE_ROOM_RATE_LIMIT = 20;
const CANCEL_ROOM_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Extract client IP from Server Action request headers. */
async function getActionClientIp(): Promise<string> {
  const headerMap = await headers();
  return getClientIpFromHeaders(headerMap);
}

/** Build a rate-limited error result with retry info and human-readable message. */
function rateLimitedResult<T = void>(baseMessage: string, resetAt: number): ActionResult<T> {
  const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const waitText = minutes > 1 ? `${minutes} minutes` : "1 minute";
  return {
    success: false,
    error: `${baseMessage} Please wait ${waitText}.`,
    retryAfterSeconds,
  };
}

export async function createRoom(): Promise<
  ActionResult<{ roomId: string; creatorSecret: string; inviteCode: string }>
> {
  const ip = await getActionClientIp();
  const limit = checkRateLimit(`create-room:${ip}`, CREATE_ROOM_RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitedResult("Too many rooms created.", limit.resetAt);
  }

  const result = await createRoomCore();
  if (result.success) {
    revalidatePath("/");
  }
  return result;
}

export async function joinRoom(
  roomId: string,
  inviteToken: string,
): Promise<ActionResult<{ joinerSecret: string }>> {
  const ip = await getActionClientIp();
  const limit = checkRateLimit(`join-room:${ip}`, JOIN_ROOM_RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitedResult("Too many attempts.", limit.resetAt);
  }

  const roomIdResult = RoomIdSchema.safeParse(roomId);
  if (!roomIdResult.success) {
    return { success: false, error: "Invalid or expired invite link." };
  }

  const tokenResult = InviteTokenSchema.safeParse(inviteToken);
  if (!tokenResult.success) {
    return { success: false, error: "Invalid or expired invite link." };
  }

  const result = await joinRoomCore(roomIdResult.data, tokenResult.data);
  if (result.success) {
    revalidatePath(`/room/${roomIdResult.data}`);
  }
  return result;
}

export async function joinByCode(
  inviteCode: string,
): Promise<ActionResult<{ joinerSecret: string; roomId: string }>> {
  const ip = await getActionClientIp();
  const limit = checkRateLimit(`join-room:${ip}`, JOIN_ROOM_RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitedResult("Too many attempts.", limit.resetAt);
  }

  if (!inviteCode || inviteCode.length !== 13) {
    return { success: false, error: "Invalid or expired invite link." };
  }

  const result = await joinRoomByCode(inviteCode);
  if (result.success) {
    revalidatePath(`/room/${result.data.roomId}`);
  }
  return result;
}

export async function approveRoom(
  roomId: string,
  participantSecret: string,
): Promise<ActionResult> {
  const ip = await getActionClientIp();
  const limit = checkRateLimit(`approve-room:${ip}`, APPROVE_ROOM_RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitedResult("Too many attempts.", limit.resetAt);
  }

  const roomIdResult = RoomIdSchema.safeParse(roomId);
  if (!roomIdResult.success) {
    return { success: false, error: "Invalid room ID" };
  }

  const secretResult = ParticipantSecretSchema.safeParse(participantSecret);
  if (!secretResult.success) {
    return { success: false, error: "Invalid credentials" };
  }

  const role = await verifyParticipant(roomIdResult.data, secretResult.data);
  if (!role) return { success: false, error: "Invalid credentials" };

  const room = await findRoomById(roomIdResult.data);
  if (!room) return { success: false, error: "Room not found" };

  // Determine target status based on role and current state
  let targetStatus: "a_approved" | "b_approved" | "completed";

  if (role === "creator") {
    if (room.status === "b_approved") {
      targetStatus = "completed";
    } else if (room.status === "ready_for_review") {
      targetStatus = "a_approved";
    } else {
      return { success: false, error: "Cannot approve in current state" };
    }
  } else {
    if (room.status === "a_approved") {
      targetStatus = "completed";
    } else if (room.status === "ready_for_review") {
      targetStatus = "b_approved";
    } else {
      return { success: false, error: "Cannot approve in current state" };
    }
  }

  const newStatus = transition(room.status, targetStatus);
  if (!newStatus) return { success: false, error: "Invalid state transition" };

  const now = new Date();
  const updates: Partial<RoomRow> = { status: newStatus };

  if (role === "creator") {
    updates.creatorApprovedAt = now;
  } else {
    updates.joinerApprovedAt = now;
  }

  if (newStatus === "completed") {
    updates.completedAt = now;
  }

  if (newStatus === "completed") {
    // Wrap status transition + grant creation in a transaction for atomicity.
    // If grant creation fails, the status transition is rolled back automatically.
    const txResult = await db.transaction(async (tx) => {
      const result = await tx
        .update(rooms)
        .set(updates)
        .where(and(eq(rooms.id, roomIdResult.data), eq(rooms.status, room.status)))
        .returning();

      if (result.length === 0) return false;

      await createDownloadGrantsInTx(roomIdResult.data, tx);
      return true;
    });

    if (!txResult) {
      return { success: false, error: "Room state changed. Please refresh and try again." };
    }
  } else {
    // Non-completion transitions: atomic CAS without transaction
    const updated = await transitionRoomStatusAtomic(roomIdResult.data, room.status, updates);
    if (!updated) {
      return { success: false, error: "Room state changed. Please refresh and try again." };
    }
  }

  logger.info("Room approved", { roomId: roomIdResult.data, role, newStatus });
  notifyRoom(roomIdResult.data);

  revalidatePath(`/room/${roomIdResult.data}`);
  return { success: true, data: undefined };
}

export async function cancelRoom(
  roomId: string,
  participantSecret: string,
  reason?: string,
): Promise<ActionResult> {
  const ip = await getActionClientIp();
  const limit = checkRateLimit(`cancel-room:${ip}`, CANCEL_ROOM_RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitedResult("Too many attempts.", limit.resetAt);
  }

  const roomIdResult = RoomIdSchema.safeParse(roomId);
  if (!roomIdResult.success) {
    return { success: false, error: "Invalid room ID" };
  }

  const secretResult = ParticipantSecretSchema.safeParse(participantSecret);
  if (!secretResult.success) {
    return { success: false, error: "Invalid credentials" };
  }

  const reasonResult = CancellationReasonSchema.safeParse(reason);
  if (!reasonResult.success) {
    return { success: false, error: "Reason is too long" };
  }

  const role = await verifyParticipant(roomIdResult.data, secretResult.data);
  if (!role) return { success: false, error: "Invalid credentials" };

  const room = await findRoomById(roomIdResult.data);
  if (!room) return { success: false, error: "Room not found" };

  if (!canTransition(room.status, "cancelled")) {
    return { success: false, error: "Cannot cancel in current state" };
  }

  // Atomic status transition: only succeeds if status still matches (prevents TOCTOU race)
  const updated = await transitionRoomStatusAtomic(roomIdResult.data, room.status, {
    status: "cancelled",
    cancelledBy: role,
    cancellationReason: reasonResult.data ?? null,
    cancelledAt: new Date(),
  });

  if (!updated) {
    return { success: false, error: "Room state changed. Please refresh and try again." };
  }

  logger.info("Room cancelled", { roomId: roomIdResult.data, role });
  notifyRoom(roomIdResult.data);

  revalidatePath(`/room/${roomIdResult.data}`);
  return { success: true, data: undefined };
}

const DOWNLOAD_GRANT_EXPIRY_HOURS = 24;

/** Create download grants within a transaction for atomicity with status transition. */
async function createDownloadGrantsInTx(roomId: string, tx: TxClient): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DOWNLOAD_GRANT_EXPIRY_HOURS * 60 * 60 * 1000);

  const tracks = await findTracksByRoomId(roomId);

  for (const track of tracks) {
    const grantRole = track.role === "creator" ? "joiner" : "creator";
    await insertGrant({
      id: generateId(),
      roomId,
      trackId: track.id,
      participantRole: grantRole,
      downloaded: false,
      downloadedAt: null,
      downloadCount: 0,
      maxDownloads: 1,
      expiresAt,
      createdAt: now,
    }, tx);
  }

  logger.info("Download grants created", { roomId, trackCount: tracks.length });
}
