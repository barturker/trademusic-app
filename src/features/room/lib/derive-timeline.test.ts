import { describe, it, expect } from "vitest";

import { deriveTimeline } from "./derive-timeline";

import type { RoomDetail } from "@/types/room";

function makeRoom(overrides: Partial<RoomDetail> = {}): RoomDetail {
  return {
    id: "room-1",
    status: "created",
    inviteToken: "abc",
    inviteUsed: false,
    createdAt: "2025-01-01T00:00:00Z",
    completedAt: null,
    expiresAt: null,
    joinedAt: null,
    creatorApprovedAt: null,
    joinerApprovedAt: null,
    cancellationReason: null,
    cancelledBy: null,
    cancelledAt: null,
    role: "creator",
    tracks: [],
    grants: [],
    allDownloadsComplete: false,
    ...overrides,
  };
}

describe("deriveTimeline", () => {
  it("always includes room_created event", () => {
    const events = deriveTimeline(makeRoom());
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("room_created");
    expect(events[0].timestamp).toBe("2025-01-01T00:00:00Z");
    expect(events[0].role).toBe("creator");
  });

  it("includes participant_joined when joinedAt is set", () => {
    const events = deriveTimeline(
      makeRoom({ joinedAt: "2025-01-01T01:00:00Z" }),
    );
    const joined = events.find((e) => e.type === "participant_joined");
    expect(joined).toBeDefined();
    expect(joined?.role).toBe("joiner");
  });

  it("does not include participant_joined when joinedAt is null", () => {
    const events = deriveTimeline(makeRoom());
    expect(events.find((e) => e.type === "participant_joined")).toBeUndefined();
  });

  it("includes track_uploaded for each track", () => {
    const events = deriveTimeline(
      makeRoom({
        tracks: [
          {
            id: "t1",
            roomId: "room-1",
            role: "creator",
            originalFilename: "beat.wav",
            fileSizeBytes: 1000,
            mimeType: "audio/wav",
            durationSeconds: null,
            bitrateKbps: null,
            sampleRateHz: null,
            codec: null,
            bpm: null,
            bpmConfidence: null,
            processingStatus: "pending",
            processingError: null,
            uploadedAt: "2025-01-01T02:00:00Z",
            processedAt: null,
          },
        ],
      }),
    );
    const uploaded = events.find((e) => e.type === "track_uploaded");
    expect(uploaded).toBeDefined();
    expect(uploaded?.metadata?.filename).toBe("beat.wav");
    expect(uploaded?.role).toBe("creator");
  });

  it("includes analysis_completed for completed tracks", () => {
    const events = deriveTimeline(
      makeRoom({
        tracks: [
          {
            id: "t1",
            roomId: "room-1",
            role: "joiner",
            originalFilename: "vocals.mp3",
            fileSizeBytes: 2000,
            mimeType: "audio/mpeg",
            durationSeconds: 120,
            bitrateKbps: 320,
            sampleRateHz: 44100,
            codec: "mp3",
            bpm: 120,
            bpmConfidence: 0.9,
            processingStatus: "completed",
            processingError: null,
            uploadedAt: "2025-01-01T02:00:00Z",
            processedAt: "2025-01-01T03:00:00Z",
          },
        ],
      }),
    );
    const completed = events.find((e) => e.type === "analysis_completed");
    expect(completed).toBeDefined();
    expect(completed?.timestamp).toBe("2025-01-01T03:00:00Z");
  });

  it("includes analysis_failed for failed tracks", () => {
    const events = deriveTimeline(
      makeRoom({
        tracks: [
          {
            id: "t1",
            roomId: "room-1",
            role: "creator",
            originalFilename: "bad.wav",
            fileSizeBytes: 500,
            mimeType: "audio/wav",
            durationSeconds: null,
            bitrateKbps: null,
            sampleRateHz: null,
            codec: null,
            bpm: null,
            bpmConfidence: null,
            processingStatus: "failed",
            processingError: "decode error",
            uploadedAt: "2025-01-01T02:00:00Z",
            processedAt: "2025-01-01T02:30:00Z",
          },
        ],
      }),
    );
    const failed = events.find((e) => e.type === "analysis_failed");
    expect(failed).toBeDefined();
    expect(failed?.timestamp).toBe("2025-01-01T02:30:00Z");
  });

  it("does not include analysis events for pending tracks", () => {
    const events = deriveTimeline(
      makeRoom({
        tracks: [
          {
            id: "t1",
            roomId: "room-1",
            role: "creator",
            originalFilename: "pending.wav",
            fileSizeBytes: 500,
            mimeType: "audio/wav",
            durationSeconds: null,
            bitrateKbps: null,
            sampleRateHz: null,
            codec: null,
            bpm: null,
            bpmConfidence: null,
            processingStatus: "pending",
            processingError: null,
            uploadedAt: "2025-01-01T02:00:00Z",
            processedAt: null,
          },
        ],
      }),
    );
    expect(events.find((e) => e.type === "analysis_completed")).toBeUndefined();
    expect(events.find((e) => e.type === "analysis_failed")).toBeUndefined();
  });

  it("includes approval events", () => {
    const events = deriveTimeline(
      makeRoom({
        creatorApprovedAt: "2025-01-01T04:00:00Z",
        joinerApprovedAt: "2025-01-01T05:00:00Z",
      }),
    );
    const creatorApproval = events.find((e) => e.type === "creator_approved");
    const joinerApproval = events.find((e) => e.type === "joiner_approved");
    expect(creatorApproval).toBeDefined();
    expect(creatorApproval?.role).toBe("creator");
    expect(joinerApproval).toBeDefined();
    expect(joinerApproval?.role).toBe("joiner");
  });

  it("includes room_completed when completedAt is set", () => {
    const events = deriveTimeline(
      makeRoom({ completedAt: "2025-01-01T06:00:00Z" }),
    );
    const completed = events.find((e) => e.type === "room_completed");
    expect(completed).toBeDefined();
    expect(completed?.timestamp).toBe("2025-01-01T06:00:00Z");
  });

  it("includes room_cancelled with reason and cancelledBy", () => {
    const events = deriveTimeline(
      makeRoom({
        cancelledAt: "2025-01-01T07:00:00Z",
        cancelledBy: "creator",
        cancellationReason: "Changed my mind",
      }),
    );
    const cancelled = events.find((e) => e.type === "room_cancelled");
    expect(cancelled).toBeDefined();
    expect(cancelled?.role).toBe("creator");
    expect(cancelled?.metadata?.reason).toBe("Changed my mind");
  });

  it("includes room_cancelled without reason when not provided", () => {
    const events = deriveTimeline(
      makeRoom({
        cancelledAt: "2025-01-01T07:00:00Z",
        cancelledBy: null,
        cancellationReason: null,
      }),
    );
    const cancelled = events.find((e) => e.type === "room_cancelled");
    expect(cancelled).toBeDefined();
    expect(cancelled?.role).toBeUndefined();
    expect(cancelled?.metadata).toBeUndefined();
  });

  it("includes room_expired when status is expired and expiresAt is set", () => {
    const events = deriveTimeline(
      makeRoom({
        status: "expired",
        expiresAt: "2025-02-01T00:00:00Z",
      }),
    );
    const expired = events.find((e) => e.type === "room_expired");
    expect(expired).toBeDefined();
    expect(expired?.timestamp).toBe("2025-02-01T00:00:00Z");
  });

  it("does not include room_expired when status is not expired", () => {
    const events = deriveTimeline(
      makeRoom({
        status: "completed",
        expiresAt: "2025-02-01T00:00:00Z",
      }),
    );
    expect(events.find((e) => e.type === "room_expired")).toBeUndefined();
  });

  it("includes download grant events", () => {
    const events = deriveTimeline(
      makeRoom({
        grants: [
          {
            id: "g1",
            roomId: "room-1",
            trackId: "t1",
            participantRole: "creator",
            token: "tok",
            downloaded: true,
            downloadedAt: "2025-01-01T09:00:00Z",
            downloadCount: 1,
            maxDownloads: 3,
            expiresAt: "2025-02-01T00:00:00Z",
            createdAt: "2025-01-01T08:00:00Z",
          },
        ],
      }),
    );
    const granted = events.find((e) => e.type === "download_granted");
    const downloaded = events.find((e) => e.type === "track_downloaded");
    expect(granted).toBeDefined();
    expect(granted?.timestamp).toBe("2025-01-01T08:00:00Z");
    expect(downloaded).toBeDefined();
    expect(downloaded?.role).toBe("creator");
  });

  it("does not include track_downloaded when downloadedAt is null", () => {
    const events = deriveTimeline(
      makeRoom({
        grants: [
          {
            id: "g1",
            roomId: "room-1",
            trackId: "t1",
            participantRole: "joiner",
            token: "tok",
            downloaded: false,
            downloadedAt: null,
            downloadCount: 0,
            maxDownloads: 3,
            expiresAt: "2025-02-01T00:00:00Z",
            createdAt: "2025-01-01T08:00:00Z",
          },
        ],
      }),
    );
    expect(events.find((e) => e.type === "track_downloaded")).toBeUndefined();
    expect(events.find((e) => e.type === "download_granted")).toBeDefined();
  });

  it("sorts events chronologically", () => {
    const events = deriveTimeline(
      makeRoom({
        createdAt: "2025-01-01T00:00:00Z",
        joinedAt: "2025-01-01T01:00:00Z",
        creatorApprovedAt: "2025-01-01T05:00:00Z",
        completedAt: "2025-01-01T06:00:00Z",
        tracks: [
          {
            id: "t1",
            roomId: "room-1",
            role: "creator",
            originalFilename: "beat.wav",
            fileSizeBytes: 1000,
            mimeType: "audio/wav",
            durationSeconds: null,
            bitrateKbps: null,
            sampleRateHz: null,
            codec: null,
            bpm: null,
            bpmConfidence: null,
            processingStatus: "completed",
            processingError: null,
            uploadedAt: "2025-01-01T02:00:00Z",
            processedAt: "2025-01-01T03:00:00Z",
          },
        ],
      }),
    );

    const timestamps = events.map((e) => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it("handles empty tracks and grants", () => {
    const events = deriveTimeline(makeRoom({ tracks: [], grants: [] }));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("room_created");
  });
});
