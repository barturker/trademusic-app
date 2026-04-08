/**
 * Per-file envelope encryption using AES-256-GCM.
 *
 * KEK (Key Encryption Key) — master key from env, wraps/unwraps DEKs.
 * DEK (Data Encryption Key) — per-file random key, encrypts actual file data.
 *
 * Flow:
 *   Encrypt: generate DEK → encrypt file with DEK → wrap DEK with KEK → store wrapped DEK in DB
 *   Decrypt: unwrap DEK with KEK → decrypt file with DEK
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const DEK_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/** Generate a random Data Encryption Key (32 bytes). */
export function generateDek(): Buffer {
  return randomBytes(DEK_LENGTH);
}

/** Generate a random IV (12 bytes for GCM). */
export function generateIv(): Buffer {
  return randomBytes(IV_LENGTH);
}

function getKek(): Buffer {
  const hex = env.ENCRYPTION_KEK;
  if (hex.length !== 64) {
    throw new Error("ENCRYPTION_KEK must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/** Wrap (encrypt) a DEK with the master KEK. Returns hex-encoded string. */
export function wrapDek(dek: Buffer): { wrappedDek: string; wrapIv: string } {
  const kek = getKek();
  const iv = generateIv();
  const cipher = createCipheriv(ALGORITHM, kek, iv);

  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    wrappedDek: combined.toString("hex"),
    wrapIv: iv.toString("hex"),
  };
}

/** Unwrap (decrypt) a DEK using the master KEK. */
export function unwrapDek(wrappedDekHex: string, wrapIvHex: string): Buffer {
  const kek = getKek();
  const iv = Buffer.from(wrapIvHex, "hex");
  const combined = Buffer.from(wrappedDekHex, "hex");

  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/** Encrypt file data with a DEK. Returns encrypted buffer (ciphertext + authTag). */
export function encryptBuffer(data: Buffer, dek: Buffer, iv: Buffer): Buffer {
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]);
}

/** Decrypt file data with a DEK. */
export function decryptBuffer(encryptedData: Buffer, dek: Buffer, ivHex: string): Buffer {
  const iv = Buffer.from(ivHex, "hex");
  const authTag = encryptedData.subarray(encryptedData.length - AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(0, encryptedData.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, dek, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
