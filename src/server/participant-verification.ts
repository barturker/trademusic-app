import { verifySecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { findRoomById } from "@/server/room-repository";

import type { ParticipantRole } from "@/types/room";

/** Verify a participant secret and return their role, or null if invalid. */
export async function verifyParticipant(
  roomId: string,
  secret: string,
): Promise<ParticipantRole | null> {
  const row = await findRoomById(roomId);
  if (!row) return null;

  const isCreator = await verifySecret(secret, env.SECRET_SALT, row.creatorSecretHash);
  if (isCreator) return "creator";

  if (row.joinerSecretHash) {
    const isJoiner = await verifySecret(secret, env.SECRET_SALT, row.joinerSecretHash);
    if (isJoiner) return "joiner";
  }

  return null;
}
