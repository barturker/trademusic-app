import type { RoomDetail } from "@/types/room";
import type { TimelineEvent } from "../types";

/**
 * Derive a sorted timeline of events from existing RoomDetail timestamps.
 * Pure function — no side effects, no API calls.
 */
export function deriveTimeline(room: RoomDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Room created
  events.push({
    id: "room_created",
    type: "room_created",
    label: "Room created",
    timestamp: room.createdAt,
    role: "creator",
  });

  // Joiner joined
  if (room.joinedAt) {
    events.push({
      id: "participant_joined",
      type: "participant_joined",
      label: "Joined the room",
      timestamp: room.joinedAt,
      role: "joiner",
    });
  }

  // Track uploads and analysis results
  for (const track of room.tracks) {
    events.push({
      id: `track_uploaded_${track.id}`,
      type: "track_uploaded",
      label: "Uploaded a track",
      timestamp: track.uploadedAt,
      role: track.role,
      metadata: { filename: track.originalFilename },
    });

    if (track.processingStatus === "completed" && track.processedAt) {
      events.push({
        id: `analysis_completed_${track.id}`,
        type: "analysis_completed",
        label: `Analysis completed`,
        timestamp: track.processedAt,
        role: track.role,
        metadata: { filename: track.originalFilename },
      });
    }

    if (track.processingStatus === "failed" && track.processedAt) {
      events.push({
        id: `analysis_failed_${track.id}`,
        type: "analysis_failed",
        label: `Analysis failed`,
        timestamp: track.processedAt,
        role: track.role,
        metadata: { filename: track.originalFilename },
      });
    }
  }

  // Approvals
  if (room.creatorApprovedAt) {
    events.push({
      id: "creator_approved",
      type: "creator_approved",
      label: "Approved",
      timestamp: room.creatorApprovedAt,
      role: "creator",
    });
  }

  if (room.joinerApprovedAt) {
    events.push({
      id: "joiner_approved",
      type: "joiner_approved",
      label: "Approved",
      timestamp: room.joinerApprovedAt,
      role: "joiner",
    });
  }

  // Room completed
  if (room.completedAt) {
    events.push({
      id: "room_completed",
      type: "room_completed",
      label: "Trade completed",
      timestamp: room.completedAt,
    });
  }

  // Room cancelled
  if (room.cancelledAt) {
    events.push({
      id: "room_cancelled",
      type: "room_cancelled",
      label: "Room cancelled",
      timestamp: room.cancelledAt,
      role: room.cancelledBy ?? undefined,
      metadata: room.cancellationReason
        ? { reason: room.cancellationReason }
        : undefined,
    });
  }

  // Room expired
  if (room.status === "expired" && room.expiresAt) {
    events.push({
      id: "room_expired",
      type: "room_expired",
      label: "Room expired",
      timestamp: room.expiresAt,
    });
  }

  // Download grants
  for (const grant of room.grants) {
    events.push({
      id: `download_granted_${grant.id}`,
      type: "download_granted",
      label: "Download grant issued",
      timestamp: grant.createdAt,
    });

    if (grant.downloadedAt) {
      events.push({
        id: `track_downloaded_${grant.id}`,
        type: "track_downloaded",
        label: "Downloaded tracks",
        timestamp: grant.downloadedAt,
        role: grant.participantRole,
      });
    }
  }

  // Sort chronologically (oldest first)
  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return events;
}
