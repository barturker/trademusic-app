import { type NextRequest, NextResponse } from "next/server";

import {
  areAllDownloadsComplete,
  getDownloadGrantsForParticipant,
  getRoom,
  getTracksForRoom,
  verifyParticipant,
} from "@/features/room/queries";
import { createArtifactToken } from "@/lib/artifact-token";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { roomId } = await params;
  const secret = request.headers.get("X-Participant-Secret");

  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await verifyParticipant(roomId, secret);
  if (!role) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isExpiredByStatus = room.status === "expired";
  const isExpiredByTTL = room.status !== "completed" && room.expiresAt && new Date(room.expiresAt) < new Date();

  if (isExpiredByStatus || isExpiredByTTL) {
    return NextResponse.json({ error: "This room has expired." }, { status: 410 });
  }

  // Always include tracks (show analysis as soon as upload completes)
  const rawTracks = await getTracksForRoom(roomId);
  const tracks = rawTracks.map((t) => ({ ...t, artifactToken: createArtifactToken(t.id) }));

  // Include download grants and completion status for completed state
  const isCompleted = room.status === "completed";
  const grants = isCompleted ? await getDownloadGrantsForParticipant(roomId, role) : [];
  const allDownloadsComplete = isCompleted ? await areAllDownloadsComplete(roomId) : false;

  return NextResponse.json({ ...room, role, tracks, grants, allDownloadsComplete });
}
