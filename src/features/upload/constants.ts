/**
 * Upload constants — re-exports from shared lib for backwards compatibility
 * within the upload feature. New cross-feature consumers should import
 * from @/lib/upload-constants directly.
 */
export {
  AUDIO_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  ACCEPT_STRING,
  MAX_FILE_SIZE_BYTES,
  MAX_DURATION_SECONDS,
  MAX_TRACKS_PER_ROLE,
  UPLOAD_RATE_LIMIT,
  TUS_CHUNK_SIZE,
  STORAGE_DIRS,
} from "@/lib/upload-constants";

export type { AudioExtension } from "@/lib/upload-constants";
