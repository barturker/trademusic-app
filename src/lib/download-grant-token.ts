/**
 * HMAC-signed download grant tokens with embedded expiry.
 *
 * Instead of storing a random token in the database, we derive the token
 * from the grant ID + expiry using HMAC-SHA256. This means:
 *   - No plaintext token stored in DB (DB compromise is harmless)
 *   - Token can be regenerated server-side for delivery to clients
 *   - Expired tokens are rejected before DB lookup (defense-in-depth)
 *   - Verification is a simple HMAC recomputation
 *
 * Token format: base64url(grantId:expiresAt:signature)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const HMAC_PREFIX = "download-grant";
const SEPARATOR = ":";

function computeSignature(data: string): string {
  return createHmac("sha256", HMAC_PREFIX + env.SECRET_SALT).update(data).digest("hex");
}

/** Create an HMAC-signed download grant token from a grant ID and expiry. */
export function createDownloadGrantToken(grantId: string, expiresAt: Date): string {
  const expiresAtMs = expiresAt.getTime();
  const data = [grantId, expiresAtMs].join(SEPARATOR);
  const signature = computeSignature(data);
  const payload = [data, signature].join(SEPARATOR);
  return Buffer.from(payload).toString("base64url");
}

/** Verify a download grant token. Returns the grant ID if valid, null otherwise. */
export function verifyDownloadGrantToken(token: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const parts = decoded.split(SEPARATOR);
  if (parts.length !== 3) return null;

  const [grantId, expiresAtStr, signature] = parts;
  if (!grantId || !expiresAtStr || !signature) return null;

  // Verify signature with timing-safe comparison
  const data = [grantId, expiresAtStr].join(SEPARATOR);
  const expectedSignature = computeSignature(data);

  const sigBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expectedSignature, "utf-8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  // Reject expired tokens before DB lookup (defense-in-depth)
  const expiresAt = Number(expiresAtStr);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return null;

  return grantId;
}
