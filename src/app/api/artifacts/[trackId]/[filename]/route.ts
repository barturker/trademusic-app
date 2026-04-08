import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { verifyArtifactToken } from "@/lib/artifact-token";
import { logger } from "@/lib/logger";
import { findTrackById } from "@/server/track-repository";

interface RouteContext {
  params: Promise<{ trackId: string; filename: string }>;
}

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? "./data/artifacts";

const MIME_MAP: Record<string, string> = {
  "spectrogram.png": "image/png",
  "waveform.json": "application/json",
  "snippet.mp3": "audio/mpeg",
  "analysis-meta.json": "application/json",
};

const ALLOWED_FILES = new Set(Object.keys(MIME_MAP));

const TRACK_ID_PATTERN = /^[0-9a-f]{24}$/;

/**
 * Serve analysis artifacts (spectrogram, waveform, snippet).
 * Requires a valid HMAC-signed artifact token (1-hour TTL).
 * Token is issued via the room API after participant authentication.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { trackId, filename } = await params;

  // Validate trackId format (defense-in-depth against path traversal)
  if (!TRACK_ID_PATTERN.test(trackId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!ALLOWED_FILES.has(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify artifact token
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verifiedTrackId = verifyArtifactToken(token);
  if (!verifiedTrackId || verifiedTrackId !== trackId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  // Verify track exists
  const track = await findTrackById(trackId);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Read and serve the artifact
  const filePath = join(ARTIFACTS_DIR, trackId, filename);
  try {
    const data = await readFile(filePath);
    const contentType = MIME_MAP[filename] ?? "application/octet-stream";

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    logger.warn("Artifact not found", { trackId, filename });
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }
}
