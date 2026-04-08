/**
 * Socket.io realtime server — standalone process.
 *
 * Usage: pnpm socket
 *
 * Features:
 *   - Secret-based auth (roomId + participantSecret)
 *   - Room-scoped events (socket room = roomId)
 *   - Participant presence tracking
 *   - Internal HTTP endpoint for server-side event emission
 */

import { createServer } from "node:http";

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { Server } from "socket.io";
import { createHmac, timingSafeEqual } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");
const SECRET_SALT = process.env.SECRET_SALT ?? "local-dev-salt-do-not-use-in-production";
const PORT = parseInt(process.env.SOCKET_PORT ?? "3001", 10);
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = getInternalSecret();

function getInternalSecret(): string {
  const secret = process.env.SOCKET_INTERNAL_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SOCKET_INTERNAL_SECRET must be set in production");
  }
  return secret ?? "local-dev-internal-secret";
}

// Minimal DB setup for auth verification
const DB_SSL = process.env.DB_SSL === "true";
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  ssl: DB_SSL ? { rejectUnauthorized: true } : undefined,
});
const db = drizzle({ client: pool });

// Import schema inline to avoid path alias issues in standalone script
import { pgTable, varchar } from "drizzle-orm/pg-core";
const rooms = pgTable("rooms", {
  id: varchar("id", { length: 24 }).primaryKey(),
  creatorSecretHash: varchar("creator_secret_hash", { length: 64 }).notNull(),
  joinerSecretHash: varchar("joiner_secret_hash", { length: 64 }),
});

async function hashSecret(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + secret);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buffer);
  const hex = "0123456789abcdef";
  let result = "";
  for (const byte of bytes) {
    result += hex[byte >> 4] + hex[byte & 0x0f];
  }
  return result;
}

const ROOM_ID_PATTERN = /^[0-9a-f]{24}$/;
const SECRET_PATTERN = /^[0-9a-f]{64}$/;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// --- Connection rate limiting ---
const MAX_CONCURRENT_PER_IP = 5;
const MAX_CONNECTS_PER_SECOND = 3;
const MAX_AUTH_FAILURES = 10;
const AUTH_BAN_DURATION_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const activeConnections = new Map<string, number>(); // IP → concurrent count
const connectAttempts = new Map<string, number[]>(); // IP → timestamps
const authFailures = new Map<string, { count: number; bannedUntil: number | null }>(); // IP → failure tracking

const PRIVATE_IP_PREFIXES = [
  "10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
  "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", "192.168.", "127.", "::1", "fd",
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

function getClientIp(handshake: { address: string; headers: Record<string, string | string[] | undefined> }): string {
  // Primary: Cloudflare's trusted header
  const cfIp = handshake.headers["cf-connecting-ip"];
  if (typeof cfIp === "string") return cfIp.trim();

  // Fallback: rightmost non-private IP from XFF
  const forwarded = handshake.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!isPrivateIp(ips[i])) return ips[i];
    }
    return ips[0] ?? handshake.address;
  }

  return handshake.address;
}

function isRateLimited(ip: string): string | null {
  // Check auth ban
  const failure = authFailures.get(ip);
  if (failure?.bannedUntil && Date.now() < failure.bannedUntil) {
    return "Too many failed attempts, try again later";
  }

  // Check concurrent connections
  const concurrent = activeConnections.get(ip) ?? 0;
  if (concurrent >= MAX_CONCURRENT_PER_IP) {
    return "Too many concurrent connections";
  }

  // Check connection rate (sliding window: 1 second)
  const now = Date.now();
  const attempts = connectAttempts.get(ip) ?? [];
  const recentAttempts = attempts.filter((t) => now - t < 1000);
  connectAttempts.set(ip, recentAttempts);

  if (recentAttempts.length >= MAX_CONNECTS_PER_SECOND) {
    return "Connection rate exceeded";
  }

  recentAttempts.push(now);
  return null;
}

function trackConnection(ip: string): void {
  activeConnections.set(ip, (activeConnections.get(ip) ?? 0) + 1);
}

function untrackConnection(ip: string): void {
  const count = (activeConnections.get(ip) ?? 1) - 1;
  if (count <= 0) activeConnections.delete(ip);
  else activeConnections.set(ip, count);
}

function recordAuthFailure(ip: string): void {
  const entry = authFailures.get(ip) ?? { count: 0, bannedUntil: null };
  entry.count++;
  if (entry.count >= MAX_AUTH_FAILURES) {
    entry.bannedUntil = Date.now() + AUTH_BAN_DURATION_MS;
    console.warn(`[socket] IP banned for auth failures: ${ip}`);
  }
  authFailures.set(ip, entry);
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authFailures) {
    if (entry.bannedUntil && now > entry.bannedUntil) authFailures.delete(ip);
  }
  for (const [ip, attempts] of connectAttempts) {
    if (attempts.length === 0 || now - attempts[attempts.length - 1] > 60_000) {
      connectAttempts.delete(ip);
    }
  }
}, CLEANUP_INTERVAL_MS);

// --- Presence tracking ---
const roomPresence = new Map<string, Set<string>>(); // roomId → Set<role>

function addPresence(roomId: string, role: string) {
  if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Set());
  roomPresence.get(roomId)?.add(role);
}

function removePresence(roomId: string, role: string) {
  roomPresence.get(roomId)?.delete(role);
  if (roomPresence.get(roomId)?.size === 0) roomPresence.delete(roomId);
}

function getPresence(roomId: string): string[] {
  return Array.from(roomPresence.get(roomId) ?? []);
}

// --- HTTP + Socket.io server ---
const httpServer = createServer((req, res) => {
  // Internal emit endpoint
  if (req.method === "POST" && req.url === "/internal/emit") {
    const MAX_BODY_SIZE = 1_048_576; // 1 MB

    // Pre-check content-length header if present
    const contentLength = parseInt(req.headers["content-length"] ?? "", 10);
    if (contentLength > MAX_BODY_SIZE) {
      res.writeHead(413);
      res.end("Payload too large");
      return;
    }

    let body = "";
    let aborted = false;
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        aborted = true;
        res.writeHead(413);
        res.end("Payload too large");
        req.destroy();
      }
    });
    req.on("end", () => {
      if (aborted) return;
      // Verify HMAC signature
      const signature = req.headers["x-signature"] as string | undefined;
      if (!signature) {
        res.writeHead(401);
        res.end("Missing signature");
        return;
      }

      const expected = createHmac("sha256", INTERNAL_SECRET).update(body).digest("hex");
      const sigBuf = Buffer.from(signature, "utf-8");
      const expBuf = Buffer.from(expected, "utf-8");
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        res.writeHead(403);
        res.end("Invalid signature");
        return;
      }

      try {
        const { roomId, event, data } = JSON.parse(body) as {
          roomId: string;
          event?: string;
          data?: Record<string, unknown>;
        };
        const eventName = event ?? "room-updated";
        io.to(`room:${roomId}`).emit(eventName, data ?? {});
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("Bad request");
      }
    });
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", connections: io.engine.clientsCount }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
  pingTimeout: 20_000,
  pingInterval: 10_000,
});

// --- Rate limit middleware (runs before auth) ---
io.use((socket, next) => {
  const ip = getClientIp(socket.handshake);
  const rejection = isRateLimited(ip);
  if (rejection) {
    console.warn(`[socket] Rate limited ${ip}: ${rejection}`);
    return next(new Error(rejection));
  }
  socket.data.clientIp = ip;
  next();
});

// --- Auth middleware ---
io.use(async (socket, next) => {
  const ip = socket.data.clientIp as string;
  const { roomId, secret } = socket.handshake.auth as {
    roomId?: string;
    secret?: string;
  };

  if (!roomId || !secret) {
    recordAuthFailure(ip);
    return next(new Error("Missing roomId or secret"));
  }

  if (!ROOM_ID_PATTERN.test(roomId) || !SECRET_PATTERN.test(secret)) {
    recordAuthFailure(ip);
    return next(new Error("Invalid credentials"));
  }

  try {
    const result = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    const room = result[0];
    if (!room) {
      recordAuthFailure(ip);
      return next(new Error("Room not found"));
    }

    const hash = await hashSecret(secret, SECRET_SALT);
    let role: string | null = null;

    if (constantTimeEqual(hash, room.creatorSecretHash)) role = "creator";
    else if (room.joinerSecretHash && constantTimeEqual(hash, room.joinerSecretHash)) role = "joiner";

    if (!role) {
      recordAuthFailure(ip);
      return next(new Error("Invalid credentials"));
    }

    socket.data.roomId = roomId;
    socket.data.role = role;
    next();
  } catch (err) {
    recordAuthFailure(ip);
    next(new Error("Auth failed"));
  }
});

// --- Connection handler ---
io.on("connection", (socket) => {
  const { roomId, role, clientIp } = socket.data as { roomId: string; role: string; clientIp: string };

  // Track connection for rate limiting
  trackConnection(clientIp);

  // Join room
  socket.join(`room:${roomId}`);
  addPresence(roomId, role);

  // Broadcast presence
  io.to(`room:${roomId}`).emit("presence", getPresence(roomId));

  console.info(`[socket] ${role} joined room ${roomId} (${io.engine.clientsCount} total)`);

  socket.on("disconnect", () => {
    untrackConnection(clientIp);
    removePresence(roomId, role);
    io.to(`room:${roomId}`).emit("presence", getPresence(roomId));
    console.info(`[socket] ${role} left room ${roomId}`);
  });
});

// --- Start ---
httpServer.listen(PORT, () => {
  console.info(`[socket] Server listening on port ${PORT}`);
  console.info(`[socket] CORS origin: ${CORS_ORIGIN}`);
});

// --- Graceful shutdown ---
const shutdown = () => {
  console.info("[socket] Shutting down...");
  io.close();
  pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
