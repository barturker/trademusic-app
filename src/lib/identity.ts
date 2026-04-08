/**
 * Client-side identity storage for room-scoped secrets.
 * Uses localStorage — only import from Client Components.
 */

import { publicEnv } from "@/lib/env";
import type { ParticipantRole } from "@/types/room";

const STORAGE_PREFIX = "tradesync_";

function storageKey(role: ParticipantRole, roomId: string): string {
  return `${STORAGE_PREFIX}${role}_${roomId}`;
}

export function saveSecret(role: ParticipantRole, roomId: string, secret: string): void {
  localStorage.setItem(storageKey(role, roomId), secret);
}

export function getSecret(role: ParticipantRole, roomId: string): string | null {
  return localStorage.getItem(storageKey(role, roomId));
}

export function clearSecret(role: ParticipantRole, roomId: string): void {
  localStorage.removeItem(storageKey(role, roomId));
}

/** Find whichever secret the user has for this room. */
export function getParticipantIdentity(
  roomId: string,
): { secret: string; role: ParticipantRole } | null {
  const creatorSecret = getSecret("creator", roomId);
  if (creatorSecret) return { secret: creatorSecret, role: "creator" };

  const joinerSecret = getSecret("joiner", roomId);
  if (joinerSecret) return { secret: joinerSecret, role: "joiner" };

  return null;
}

/** Store the invite code for a room (only available to creator). */
export function saveInviteCode(roomId: string, code: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}invite_${roomId}`, code);
}

/** Retrieve the stored invite code for a room. */
export function getInviteCode(roomId: string): string | null {
  return localStorage.getItem(`${STORAGE_PREFIX}invite_${roomId}`);
}

/** Build a short invite URL for sharing (e.g. trademusic.app/j/Ax8kZ2mN4pQ). */
export function buildInviteUrl(inviteCode: string): string {
  return `${publicEnv.APP_URL}/j/${inviteCode}`;
}

/** @deprecated Use saveInviteCode instead. Kept for backward compat during migration. */
export const saveInviteToken = saveInviteCode;

/** @deprecated Use getInviteCode instead. */
export const getInviteToken = getInviteCode;

/** Extract invite token from a URL hash fragment (e.g. `#token=abc`). Legacy support. */
export function parseTokenFromHash(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("token") ?? "";
}
