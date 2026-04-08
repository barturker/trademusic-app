export const ROOM_STATUSES = [
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
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const PARTICIPANT_ROLES = ["creator", "joiner"] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const PROCESSING_STATUSES = ["pending", "processing", "completed", "failed"] as const;

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export interface Room {
  id: string;
  status: RoomStatus;
  inviteToken: string;
  inviteUsed: boolean;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  joinedAt: string | null;
  creatorApprovedAt: string | null;
  joinerApprovedAt: string | null;
  cancellationReason: string | null;
  cancelledBy: ParticipantRole | null;
  cancelledAt: string | null;
}

export interface Track {
  id: string;
  roomId: string;
  role: ParticipantRole;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number | null;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  codec: string | null;
  bpm: number | null;
  bpmConfidence: number | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  uploadedAt: string;
  processedAt: string | null;
  artifactToken?: string;
}

export interface DownloadGrant {
  id: string;
  roomId: string;
  trackId: string | null;
  participantRole: ParticipantRole;
  token: string;
  downloaded: boolean;
  downloadedAt: string | null;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string;
  createdAt: string;
}

/** Extended room data returned by the API (includes tracks + grants). */
export interface RoomDetail extends Room {
  role: ParticipantRole;
  tracks: Track[];
  grants: DownloadGrant[];
  allDownloadsComplete: boolean;
}
