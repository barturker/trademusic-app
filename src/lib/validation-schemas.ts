/**
 * Shared Zod validation schemas used across features.
 * Lives in src/lib/ to avoid cross-feature imports.
 */
import { z } from "zod";

const ROOM_ID_LENGTH = 24;
const SECRET_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]+$/;

/** Reusable hex-string validator. */
function hexString(length: number, label: string) {
  return z
    .string()
    .length(length, `${label} must be ${length} characters`)
    .regex(HEX_PATTERN, `${label} must be lowercase hex`);
}

export const RoomIdSchema = hexString(ROOM_ID_LENGTH, "Room ID");

export const ParticipantSecretSchema = hexString(SECRET_LENGTH, "Participant secret");
