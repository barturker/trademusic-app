import { describe, it, expect } from "vitest";

import {
  computeContentHash,
  generateId,
  generateSecret,
  generateToken,
  hashSecret,
  verifySecret,
  hashToken,
  verifyToken,
} from "./crypto";

const HEX_PATTERN = /^[0-9a-f]+$/;

describe("crypto", () => {
  describe("generateId", () => {
    it("returns a 24-character hex string", () => {
      const id = generateId();
      expect(id).toHaveLength(24);
      expect(id).toMatch(HEX_PATTERN);
    });

    it("returns unique values on successive calls", () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateId()));
      expect(ids.size).toBe(50);
    });
  });

  describe("generateSecret", () => {
    it("returns a 64-character hex string", () => {
      const secret = generateSecret();
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(HEX_PATTERN);
    });
  });

  describe("generateToken", () => {
    it("returns a 64-character hex string", () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(HEX_PATTERN);
    });
  });

  describe("hashSecret", () => {
    it("returns a 64-character hex string (SHA-256)", async () => {
      const hash = await hashSecret("mysecret", "salt123");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(HEX_PATTERN);
    });

    it("produces deterministic output for same input", async () => {
      const hash1 = await hashSecret("secret", "salt");
      const hash2 = await hashSecret("secret", "salt");
      expect(hash1).toBe(hash2);
    });

    it("produces different output for different salts", async () => {
      const hash1 = await hashSecret("secret", "salt-a");
      const hash2 = await hashSecret("secret", "salt-b");
      expect(hash1).not.toBe(hash2);
    });

    it("produces different output for different secrets", async () => {
      const hash1 = await hashSecret("secret-a", "salt");
      const hash2 = await hashSecret("secret-b", "salt");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifySecret", () => {
    it("returns true for a matching secret", async () => {
      const secret = "test-secret-value";
      const salt = "test-salt";
      const hash = await hashSecret(secret, salt);
      expect(await verifySecret(secret, salt, hash)).toBe(true);
    });

    it("returns false for a wrong secret", async () => {
      const salt = "test-salt";
      const hash = await hashSecret("correct-secret", salt);
      expect(await verifySecret("wrong-secret", salt, hash)).toBe(false);
    });

    it("returns false for a wrong salt", async () => {
      const secret = "test-secret";
      const hash = await hashSecret(secret, "correct-salt");
      expect(await verifySecret(secret, "wrong-salt", hash)).toBe(false);
    });

    it("returns false for a hash with different length", async () => {
      const result = await verifySecret("secret", "salt", "short");
      expect(result).toBe(false);
    });
  });

  describe("computeContentHash", () => {
    it("returns a 64-character hex string (SHA-256)", () => {
      const hash = computeContentHash(Buffer.from("test audio data"));
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(HEX_PATTERN);
    });

    it("produces deterministic output for same input", () => {
      const data = Buffer.from("identical content");
      expect(computeContentHash(data)).toBe(computeContentHash(data));
    });

    it("produces different output for different input", () => {
      const hash1 = computeContentHash(Buffer.from("track-a"));
      const hash2 = computeContentHash(Buffer.from("track-b"));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("hashToken", () => {
    it("returns a 64-character hex string (HMAC-SHA256)", () => {
      const hash = hashToken("mytoken", "mysalt");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(HEX_PATTERN);
    });

    it("produces deterministic output", () => {
      const hash1 = hashToken("token", "salt");
      const hash2 = hashToken("token", "salt");
      expect(hash1).toBe(hash2);
    });

    it("differs with different tokens", () => {
      const hash1 = hashToken("token-a", "salt");
      const hash2 = hashToken("token-b", "salt");
      expect(hash1).not.toBe(hash2);
    });

    it("differs with different salts", () => {
      const hash1 = hashToken("token", "salt-a");
      const hash2 = hashToken("token", "salt-b");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyToken", () => {
    it("returns true for a matching token", () => {
      const token = "test-token";
      const salt = "test-salt";
      const hash = hashToken(token, salt);
      expect(verifyToken(token, salt, hash)).toBe(true);
    });

    it("returns false for a wrong token", () => {
      const salt = "test-salt";
      const hash = hashToken("correct-token", salt);
      expect(verifyToken("wrong-token", salt, hash)).toBe(false);
    });

    it("returns false for a hash with different length", () => {
      expect(verifyToken("token", "salt", "short")).toBe(false);
    });
  });
});
