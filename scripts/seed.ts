/**
 * Seed script — inserts test rooms into PostgreSQL.
 *
 * Usage: pnpm db:seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { rooms } from "../src/server/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");

const SEED_ROOMS = [
  {
    id: "seed_room_created_001",
    status: "created" as const,
    creatorSecretHash: "a".repeat(64),
    joinerSecretHash: null,
    inviteTokenHash: "invite_token_hash_seed_001",
    inviteUsed: false,
    createdAt: new Date(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    creatorApprovedAt: null,
    joinerApprovedAt: null,
    cancellationReason: null,
    cancelledBy: null,
  },
  {
    id: "seed_room_waiting_002",
    status: "waiting_for_peer" as const,
    creatorSecretHash: "b".repeat(64),
    joinerSecretHash: "c".repeat(64),
    inviteTokenHash: "invite_token_hash_seed_002",
    inviteUsed: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    completedAt: null,
    expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
    creatorApprovedAt: null,
    joinerApprovedAt: null,
    cancellationReason: null,
    cancelledBy: null,
  },
  {
    id: "seed_room_complete_003",
    status: "completed" as const,
    creatorSecretHash: "d".repeat(64),
    joinerSecretHash: "e".repeat(64),
    inviteTokenHash: "invite_token_hash_seed_003",
    inviteUsed: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 30 * 60 * 1000),
    expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000),
    creatorApprovedAt: new Date(Date.now() - 60 * 60 * 1000),
    joinerApprovedAt: new Date(Date.now() - 30 * 60 * 1000),
    cancellationReason: null,
    cancelledBy: null,
  },
];

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle({ client: pool });

  console.info("Seeding database...");

  for (const room of SEED_ROOMS) {
    await db.insert(rooms).values(room).onConflictDoNothing();
    console.info(`  Inserted room: ${room.id} (${room.status})`);
  }

  console.info("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
