/**
 * Core room operations shared between Server Actions and Route Handlers.
 * Each function returns an ActionResult so callers can map to their response format.
 */
import { generateId, generateInviteCode, generateSecret, hashSecret, hashToken, verifyToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { transition } from "@/lib/room-machine";
import { notifyRoom } from "@/lib/socket-emitter";
import { claimInviteAtomic, findRoomById, findRoomByInviteCodeHash, insertRoom } from "@/server/room-repository";

import type { ActionResult } from "@/types/actions";
import type { RoomRow } from "../types";

const INVITE_EXPIRY_HOURS = 24;
const GENERIC_JOIN_ERROR = "Invalid or expired invite link.";

interface CreateRoomResult {
  roomId: string;
  creatorSecret: string;
  inviteCode: string;
}

/** Core create-room logic: generates secrets, inserts row, returns result. */
export async function createRoomCore(): Promise<ActionResult<CreateRoomResult>> {
  const roomId = generateId();
  const creatorSecret = generateSecret();
  const inviteCode = generateInviteCode();
  const creatorSecretHash = await hashSecret(creatorSecret, env.SECRET_SALT);

  const now = new Date();
  const inviteExpiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  const inviteTokenHash = hashToken(inviteCode, env.SECRET_SALT);

  const room: RoomRow = {
    id: roomId,
    status: "created",
    creatorSecretHash,
    joinerSecretHash: null,
    inviteTokenHash,
    inviteUsed: false,
    createdAt: now,
    completedAt: null,
    expiresAt: inviteExpiresAt,
    joinedAt: null,
    creatorApprovedAt: null,
    joinerApprovedAt: null,
    cancellationReason: null,
    cancelledBy: null,
    cancelledAt: null,
  };

  await insertRoom(room);
  logger.info("Room created", { roomId });

  return {
    success: true,
    data: { roomId, creatorSecret, inviteCode },
  };
}

interface JoinRoomResult {
  joinerSecret: string;
}

/** Core join-room logic: validates token, claims invite atomically, returns joiner secret. */
export async function joinRoomCore(
  roomId: string,
  inviteToken: string,
): Promise<ActionResult<JoinRoomResult>> {
  const room = await findRoomById(roomId);
  if (!room) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  if (room.inviteUsed) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  // Timing-safe token verification (prevents timing attacks on invite token)
  if (!verifyToken(inviteToken, env.SECRET_SALT, room.inviteTokenHash)) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  if (room.expiresAt && room.expiresAt < new Date()) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  const newStatus = transition(room.status, "waiting_for_peer");
  if (!newStatus) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  const joinerSecret = generateSecret();
  const joinerSecretHash = await hashSecret(joinerSecret, env.SECRET_SALT);

  // Atomic claim: only succeeds if invite_used is still false (prevents TOCTOU race)
  const claimed = await claimInviteAtomic(roomId, {
    joinerSecretHash,
    inviteUsed: true,
    status: newStatus,
    joinedAt: new Date(),
  });

  if (!claimed) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  logger.info("Participant joined room", { roomId });
  notifyRoom(roomId);

  return {
    success: true,
    data: { joinerSecret },
  };
}

/** Join a room using a short invite code. Looks up room by code hash, then joins. */
export async function joinRoomByCode(
  inviteCode: string,
): Promise<ActionResult<JoinRoomResult & { roomId: string }>> {
  const codeHash = hashToken(inviteCode, env.SECRET_SALT);
  const room = await findRoomByInviteCodeHash(codeHash);

  if (!room) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  if (room.inviteUsed) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  if (room.expiresAt && room.expiresAt < new Date()) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  const newStatus = transition(room.status, "waiting_for_peer");
  if (!newStatus) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  const joinerSecret = generateSecret();
  const joinerSecretHash = await hashSecret(joinerSecret, env.SECRET_SALT);

  const claimed = await claimInviteAtomic(room.id, {
    joinerSecretHash,
    inviteUsed: true,
    status: newStatus,
    joinedAt: new Date(),
  });

  if (!claimed) {
    return { success: false, error: GENERIC_JOIN_ERROR };
  }

  logger.info("Participant joined room via short code", { roomId: room.id });
  notifyRoom(room.id);

  return {
    success: true,
    data: { joinerSecret, roomId: room.id },
  };
}
