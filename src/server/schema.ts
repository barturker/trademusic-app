import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const roomStatusEnum = pgEnum("room_status", [
  "created",
  "waiting_for_peer",
  "processing",
  "ready_for_review",
  "a_approved",
  "b_approved",
  "completed",
  "cancelled",
  "disputed",
  "expired",
]);

export const participantRoleEnum = pgEnum("participant_role", ["creator", "joiner"]);

export const processingStatusEnum = pgEnum("processing_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

// --- Tables ---

export const rooms = pgTable(
  "rooms",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    status: roomStatusEnum("status").notNull().default("created"),
    creatorSecretHash: varchar("creator_secret_hash", { length: 64 }).notNull(),
    joinerSecretHash: varchar("joiner_secret_hash", { length: 64 }),
    inviteTokenHash: varchar("invite_token_hash", { length: 64 }).notNull().unique(),
    inviteUsed: boolean("invite_used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    creatorApprovedAt: timestamp("creator_approved_at", { withTimezone: true }),
    joinerApprovedAt: timestamp("joiner_approved_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: participantRoleEnum("cancelled_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    index("rooms_status_idx").on(table.status),
    index("rooms_expires_at_idx").on(table.expiresAt),
  ],
);

export const tracks = pgTable(
  "tracks",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    roomId: varchar("room_id", { length: 24 })
      .notNull()
      .references(() => rooms.id),
    role: participantRoleEnum("role").notNull(),
    originalFilename: text("original_filename").notNull(),
    storedFilename: varchar("stored_filename", { length: 64 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    durationSeconds: integer("duration_seconds"),
    bitrateKbps: integer("bitrate_kbps"),
    sampleRateHz: integer("sample_rate_hz"),
    codec: varchar("codec", { length: 32 }),
    bpm: integer("bpm"),
    bpmConfidence: integer("bpm_confidence"),
    spectrogramPath: text("spectrogram_path"),
    waveformJsonPath: text("waveform_json_path"),
    snippetPath: text("snippet_path"),
    contentHash: varchar("content_hash", { length: 64 }),
    encryptedDek: text("encrypted_dek"),
    encryptionIv: text("encryption_iv"),
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    processingError: text("processing_error"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [index("tracks_room_id_idx").on(table.roomId)],
);

export const downloadGrants = pgTable(
  "download_grants",
  {
    id: varchar("id", { length: 24 }).primaryKey(),
    roomId: varchar("room_id", { length: 24 })
      .notNull()
      .references(() => rooms.id),
    trackId: varchar("track_id", { length: 24 }).references(() => tracks.id),
    participantRole: participantRoleEnum("participant_role").notNull(),
    // Token is HMAC-derived from grant ID — not stored in DB
    downloaded: boolean("downloaded").notNull().default(false),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
    downloadCount: integer("download_count").notNull().default(0),
    maxDownloads: integer("max_downloads").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("download_grants_room_id_idx").on(table.roomId),
    unique("download_grants_room_track_role_unique").on(table.roomId, table.trackId, table.participantRole),
  ],
);
