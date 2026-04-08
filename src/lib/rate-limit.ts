/**
 * In-memory sliding-window rate limiter.
 *
 * LIMITATION: This store is per-process. In a multi-instance deployment,
 * each instance tracks its own counters independently. An attacker can
 * bypass limits by distributing requests across instances.
 * Replace with a shared Redis store for production (Phase 9).
 */

import { logger } from "@/lib/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Warn once at startup if running in production with in-memory store
if (process.env.NODE_ENV === "production") {
  logger.warn(
    "Rate limiter is using an in-memory store — limits are per-process and not shared across instances. " +
      "Deploy a Redis-backed store for production use.",
  );
}

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within the rate limit.
 * @param key - Unique key (e.g., IP address + action)
 * @param limit - Max requests per window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// --- IP extraction ---

const PRIVATE_IP_PREFIXES = [
  "10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
  "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", "192.168.", "127.", "::1", "fd",
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

/** Walk XFF right-to-left, return first non-private IP. */
function extractRightmostPublicIp(xff: string): string | null {
  const ips = xff.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = ips.length - 1; i >= 0; i--) {
    if (!isPrivateIp(ips[i])) return ips[i];
  }
  return ips[0] ?? null;
}

/**
 * Get client IP from a Headers object (Server Actions use `await headers()`).
 *
 * Priority:
 *   1. CF-Connecting-IP — set by Cloudflare, trustworthy when origin is
 *      firewalled to Cloudflare IP ranges (UFW rules).
 *   2. X-Forwarded-For (rightmost non-private IP) — fallback for non-CF
 *      environments. Uses rightmost-untrusted to prevent spoofing.
 *   3. X-Real-IP / loopback — local development fallback.
 */
export function getClientIpFromHeaders(headerMap: Headers): string {
  const cfIp = headerMap.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xff = headerMap.get("x-forwarded-for");
  if (xff) {
    const rightmost = extractRightmostPublicIp(xff);
    if (rightmost) return rightmost;
  }

  return headerMap.get("x-real-ip") ?? "127.0.0.1";
}

/**
 * Get client IP from a Request object (Route Handlers).
 *
 * Same priority as getClientIpFromHeaders — delegates to it internally.
 */
export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}
