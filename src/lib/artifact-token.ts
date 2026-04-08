/**
 * HMAC-signed artifact tokens for time-limited access to analysis files.
 *
 * Prevents unauthorized access to spectrograms, waveforms, and snippets
 * even if a trackId is leaked. Tokens are per-track with 1-hour TTL.
 *
 * Token format: base64url(trackId:expiresAt:signature)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const ARTIFACT_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const SEPARATOR = ":";
const HMAC_PREFIX = "artifact";

function computeSignature(data: string): string {
  return createHmac("sha256", HMAC_PREFIX + env.SECRET_SALT).update(data).digest("hex");
}

/** Generate an HMAC-signed artifact access token for a track. */
export function createArtifactToken(trackId: string): string {
  const expiresAt = Date.now() + ARTIFACT_TOKEN_TTL_MS;
  const data = [trackId, expiresAt].join(SEPARATOR);
  const signature = computeSignature(data);
  const token = [data, signature].join(SEPARATOR);
  return Buffer.from(token).toString("base64url");
}

/** Verify an artifact token. Returns the trackId if valid, null otherwise. */
export function verifyArtifactToken(token: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const parts = decoded.split(SEPARATOR);
  if (parts.length !== 3) return null;

  const [trackId, expiresAtStr, signature] = parts;
  if (!trackId || !expiresAtStr || !signature) return null;

  // Verify signature with timing-safe comparison
  const data = [trackId, expiresAtStr].join(SEPARATOR);
  const expectedSignature = computeSignature(data);

  const sigBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expectedSignature, "utf-8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  // Check expiry
  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return null;

  return trackId;
}
