import { z } from "zod";

import type { UploadProgress } from "@/lib/upload-constants";
import type { ParticipantRole } from "@/types/room";

// Re-export shared queue types so existing internal imports still work
export type { UploadProgress, QueueItem, QueueItemStatus } from "@/lib/upload-constants";

/** Database row type for tracks — defined manually to avoid coupling to server/schema. */
export interface TrackRow {
  id: string;
  roomId: string;
  role: ParticipantRole;
  originalFilename: string;
  storedFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number | null;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  codec: string | null;
  bpm: number | null;
  bpmConfidence: number | null;
  spectrogramPath: string | null;
  waveformJsonPath: string | null;
  snippetPath: string | null;
  encryptedDek: string | null;
  encryptionIv: string | null;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  processingError: string | null;
  uploadedAt: Date;
  processedAt: Date | null;
}

/** Upload state machine. */
export type UploadStatus = "idle" | "uploading" | "encrypting" | "complete" | "error";

/** Upload state for the hook. */
export interface UploadState {
  status: UploadStatus;
  progress: UploadProgress;
  error: string | null;
  uploadUrl: string | null;
}

/** tusd hook event names we handle. */
export type TusdHookEvent = "pre-create" | "post-finish" | "post-terminate";

/** tusd webhook request body (subset of fields we use). */
export interface TusdHookPayload {
  Type: TusdHookEvent;
  Event: {
    Upload: {
      ID: string;
      Size: number;
      Offset: number;
      MetaData: Record<string, string>;
      Storage?: {
        Type: string;
        Path: string;
      } | null;
    };
    HTTPRequest: {
      Method: string;
      URI: string;
      RemoteAddr: string;
    };
  };
}

/** Zod schema for validating tusd webhook payloads. */
export const TusdHookPayloadSchema = z.object({
  Type: z.enum(["pre-create", "post-finish", "post-terminate"]),
  Event: z.object({
    Upload: z.object({
      ID: z.string(),
      Size: z.number(),
      Offset: z.number(),
      MetaData: z.record(z.string(), z.string()),
      Storage: z
        .object({
          Type: z.string(),
          Path: z.string(),
        })
        .nullish(),
    }),
    HTTPRequest: z.object({
      Method: z.string(),
      URI: z.string(),
      RemoteAddr: z.string(),
    }),
  }),
});

/** Metadata fields we expect in TUS upload metadata. */
export interface UploadMetadata {
  roomId: string;
  participantSecret: string;
  filename: string;
  filetype: string;
}
