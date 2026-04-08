CREATE TYPE "public"."participant_role" AS ENUM('creator', 'joiner');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('created', 'waiting_for_peer', 'processing', 'ready_for_review', 'a_approved', 'b_approved', 'completed', 'cancelled', 'disputed', 'expired');--> statement-breakpoint
CREATE TABLE "download_grants" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"room_id" varchar(24) NOT NULL,
	"track_id" varchar(24),
	"participant_role" "participant_role" NOT NULL,
	"token" varchar(64) NOT NULL,
	"downloaded" boolean DEFAULT false NOT NULL,
	"downloaded_at" timestamp with time zone,
	"download_count" integer DEFAULT 0 NOT NULL,
	"max_downloads" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "download_grants_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"status" "room_status" DEFAULT 'created' NOT NULL,
	"creator_secret_hash" varchar(64) NOT NULL,
	"joiner_secret_hash" varchar(64),
	"invite_token" varchar(64) NOT NULL,
	"invite_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"creator_approved_at" timestamp with time zone,
	"joiner_approved_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancelled_by" "participant_role",
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "rooms_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"room_id" varchar(24) NOT NULL,
	"role" "participant_role" NOT NULL,
	"original_filename" text NOT NULL,
	"stored_filename" varchar(64) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"duration_seconds" integer,
	"bitrate_kbps" integer,
	"sample_rate_hz" integer,
	"codec" varchar(32),
	"bpm" integer,
	"bpm_confidence" integer,
	"spectrogram_path" text,
	"waveform_json_path" text,
	"snippet_path" text,
	"encrypted_dek" text,
	"encryption_iv" text,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "download_grants" ADD CONSTRAINT "download_grants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_grants" ADD CONSTRAINT "download_grants_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_grants_room_id_idx" ON "download_grants" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "rooms_status_idx" ON "rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rooms_expires_at_idx" ON "rooms" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tracks_room_id_idx" ON "tracks" USING btree ("room_id");