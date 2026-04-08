/**
 * Server-side cryptographic utilities for TradeSync identity model.
 *
 * - Secrets are generated server-side and transmitted to the client once.
 * - Only SHA-256 hashes are stored in the database.
 * - Uses Web Crypto API (available in Node.js 20+ and Next.js server runtime).
 * - Token hashing uses HMAC-SHA256 via Node.js crypto for DB storage.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const ID_LENGTH = 12;
const SECRET_LENGTH = 32;
const TOKEN_LENGTH = 32;
const INVITE_CODE_LENGTH = 13;
const HEX_CHARS = "0123456789abcdef";
const URL_SAFE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

function randomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (const byte of bytes) {
    result += HEX_CHARS[byte >> 4] + HEX_CHARS[byte & 0x0f];
  }
  return result;
}

/** Generate a short room ID (24 hex chars). */
export function generateId(): string {
  return randomHex(ID_LENGTH);
}

/** Generate a participant secret (64 hex chars). */
export function generateSecret(): string {
  return randomHex(SECRET_LENGTH);
}

/** Generate a one-use token for invites or download grants (64 hex chars). */
export function generateToken(): string {
  return randomHex(TOKEN_LENGTH);
}

/** Generate a short, URL-safe invite code (13 chars, ~78 bits entropy). */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  let result = "";
  for (const byte of bytes) {
    result += URL_SAFE_CHARS[byte % URL_SAFE_CHARS.length];
  }
  return result;
}

/** Hash a secret with SHA-256 + salt for storage. Returns hex string. */
export async function hashSecret(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + secret);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buffer);

  let hex = "";
  for (const byte of bytes) {
    hex += HEX_CHARS[byte >> 4] + HEX_CHARS[byte & 0x0f];
  }
  return hex;
}

/** Verify a secret against a stored hash. */
export async function verifySecret(secret: string, salt: string, storedHash: string): Promise<boolean> {
  const hash = await hashSecret(secret, salt);
  // Constant-time comparison to prevent timing attacks
  if (hash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/** Compute SHA-256 hash of a Buffer. Returns 64-char hex string. */
export function computeContentHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

const TOKEN_HMAC_PREFIX = "token";

/** Hash a token with HMAC-SHA256 for secure DB storage. Synchronous. */
export function hashToken(token: string, salt: string): string {
  return createHmac("sha256", TOKEN_HMAC_PREFIX + salt).update(token).digest("hex");
}

/** Verify a token against a stored HMAC hash. Timing-safe. */
export function verifyToken(token: string, salt: string, storedHash: string): boolean {
  const hash = hashToken(token, salt);
  const hashBuf = Buffer.from(hash, "utf-8");
  const storedBuf = Buffer.from(storedHash, "utf-8");
  if (hashBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(hashBuf, storedBuf);
}
