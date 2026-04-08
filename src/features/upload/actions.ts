"use server";

import { headers } from "next/headers";

import { verifyParticipant } from "@/server/participant-verification";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { isTerminal } from "@/lib/room-machine";
import { createUploadToken } from "@/lib/upload-token";
import { RoomIdSchema, ParticipantSecretSchema } from "@/lib/validation-schemas";
import { findRoomById } from "@/server/room-repository";

import type { ActionResult } from "@/types/actions";

const UPLOAD_TOKEN_RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Exchange a participant secret for a short-lived HMAC-signed upload token. */
export async function getUploadToken(
  roomId: string,
  participantSecret: string,
): Promise<ActionResult<{ uploadToken: string }>> {
  const headerMap = await headers();
  const ip = getClientIpFromHeaders(headerMap);
  const limit = checkRateLimit(`upload-token:${ip}`, UPLOAD_TOKEN_RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    const retryAfterSeconds = Math.ceil((limit.resetAt - Date.now()) / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    const waitText = minutes > 1 ? `${minutes} minutes` : "1 minute";
    return { success: false, error: `Too many attempts. Please wait ${waitText}.`, retryAfterSeconds };
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
  if (!role) {
    return { success: false, error: "Invalid credentials" };
  }

  const room = await findRoomById(roomIdResult.data);
  if (!room || isTerminal(room.status)) {
    return { success: false, error: "Room is not accepting uploads" };
  }

  if (room.expiresAt && room.expiresAt < new Date()) {
    return { success: false, error: "Room is not accepting uploads" };
  }

  const uploadToken = createUploadToken(roomIdResult.data, role);
  return { success: true, data: { uploadToken } };
}
