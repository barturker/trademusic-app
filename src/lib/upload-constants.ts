/**
 * Shared upload constants and types used by both room and upload features.
 * Lives in src/lib/ to avoid cross-feature imports.
 */

/** Supported audio file extensions (lowercase, without dot). */
export const AUDIO_EXTENSIONS = [
  "wav",
  "aiff",
  "aif",
  "flac",
  "mp3",
  "m4a",
  "aac",
  "ogg",
  "opus",
  "wma",
] as const;

export type AudioExtension = (typeof AUDIO_EXTENSIONS)[number];

/** Map of extension to MIME types for validation. */
export const EXTENSION_MIME_MAP: Record<AudioExtension, readonly string[]> = {
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  aiff: ["audio/aiff", "audio/x-aiff"],
  aif: ["audio/aiff", "audio/x-aiff"],
  flac: ["audio/flac", "audio/x-flac"],
  mp3: ["audio/mpeg", "audio/mp3"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/aac"],
  aac: ["audio/aac", "audio/aacp"],
  ogg: ["audio/ogg", "application/ogg"],
  opus: ["audio/opus", "audio/ogg"],
  wma: ["audio/x-ms-wma"],
} as const;

/** All accepted MIME types (flattened). */
export const ACCEPTED_MIME_TYPES = [...new Set(Object.values(EXTENSION_MIME_MAP).flat())];

/** File input accept string for HTML input/dropzone. */
export const ACCEPT_STRING = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/** Maximum file size in bytes (150 MB). */
export const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024;

/** Maximum audio duration in seconds (30 minutes). */
export const MAX_DURATION_SECONDS = 30 * 60;

/** Maximum tracks a single participant can upload per room. */
export const MAX_TRACKS_PER_ROLE = 5;

/** Maximum uploads per IP per hour. */
export const UPLOAD_RATE_LIMIT = 10;

/** TUS chunk size in bytes (1 MB — balance between progress granularity and overhead). */
export const TUS_CHUNK_SIZE = 1 * 1024 * 1024;

/** File storage directory names. */
export const STORAGE_DIRS = {
  UPLOADS: "uploads",
  ARTIFACTS: "artifacts",
  TMP: "tmp",
} as const;

// --- Queue types (shared between room and upload features) ---

/** Upload progress state. */
export interface UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}

/** Status for a single file in the upload queue. */
export type QueueItemStatus = "queued" | "uploading" | "complete" | "error";

/** A single file in the upload queue. */
export interface QueueItem {
  id: string;
  file: File;
  status: QueueItemStatus;
  progress: UploadProgress;
  error: string | null;
}
