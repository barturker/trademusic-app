/**
 * HMAC-signed upload tokens for TUS upload authentication.
 *
 * Replaces raw participant secrets in TUS metadata with short-lived,
 * self-contained tokens that prove upload permission without exposing secrets.
 *
 * Token format: base64url(roomId:role:expiresAt:signature)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

import type { ParticipantRole } from "@/types/room";

const UPLOAD_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SEPARATOR = ":";

interface UploadTokenPayload {
  roomId: string;
  role: ParticipantRole;
  expiresAt: number;
}

function computeSignature(data: string): string {
  return createHmac("sha256", env.SECRET_SALT).update(data).digest("hex");
}

/** Generate an HMAC-signed upload token for a verified participant. */
export function createUploadToken(roomId: string, role: ParticipantRole): string {
  const expiresAt = Date.now() + UPLOAD_TOKEN_TTL_MS;
  const data = [roomId, role, expiresAt].join(SEPARATOR);
  const signature = computeSignature(data);
  const token = [data, signature].join(SEPARATOR);
  return Buffer.from(token).toString("base64url");
}

/** Verify an upload token and return the payload, or null if invalid/expired. */
export function verifyUploadToken(token: string): UploadTokenPayload | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const parts = decoded.split(SEPARATOR);
  if (parts.length !== 4) return null;

  const [roomId, role, expiresAtStr, signature] = parts;
  if (!roomId || !role || !expiresAtStr || !signature) return null;

  // Validate role
  if (role !== "creator" && role !== "joiner") return null;

  // Verify signature with timing-safe comparison
  const data = [roomId, role, expiresAtStr].join(SEPARATOR);
  const expectedSignature = computeSignature(data);

  const sigBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expectedSignature, "utf-8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  // Check expiry
  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return null;

  return { roomId, role: role as ParticipantRole, expiresAt };
}
