import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { type NextRequest, NextResponse } from "next/server";

import { computeContentHash } from "@/lib/crypto";
import { verifyDownloadGrantToken } from "@/lib/download-grant-token";
import { decryptBuffer, unwrapDek } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { findGrantById, markGrantUsedAtomic } from "@/server/download-grant-repository";
import { findTrackById, updateTrack } from "@/server/track-repository";
import { ACCEPTED_MIME_TYPES } from "@/features/upload/constants";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./data/uploads";

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { roomId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Download token is required" }, { status: 400 });
  }

  // Verify HMAC-signed token and extract grant ID
  const grantId = verifyDownloadGrantToken(token);
  if (!grantId) {
    return NextResponse.json({ error: "Invalid download token" }, { status: 401 });
  }

  const grant = await findGrantById(grantId);
  if (!grant) {
    return NextResponse.json({ error: "Invalid download token" }, { status: 401 });
  }

  if (grant.roomId !== roomId) {
    return NextResponse.json({ error: "Token does not match room" }, { status: 403 });
  }

  if (new Date() > grant.expiresAt) {
    return NextResponse.json({ error: "Download link has expired" }, { status: 403 });
  }

  // Find the track associated with this grant
  if (!grant.trackId) {
    return NextResponse.json({ error: "Grant has no associated track" }, { status: 500 });
  }

  const track = await findTrackById(grant.trackId);
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Atomically claim the grant — prevents double-download race
  const claimed = await markGrantUsedAtomic(grant.id);
  if (!claimed) {
    return NextResponse.json({ error: "Download already used" }, { status: 403 });
  }

  // Decrypt the file
  const dekParts = track.encryptedDek?.split(":") ?? [];
  if (dekParts.length !== 2 || !track.encryptionIv) {
    return NextResponse.json({ error: "Track encryption metadata missing" }, { status: 500 });
  }

  try {
    const [wrappedDek, wrapIv] = dekParts;
    const dek = unwrapDek(wrappedDek, wrapIv);

    const encryptedPath = join(UPLOAD_DIR, track.storedFilename);
    const encryptedData = await readFile(encryptedPath);
    const plaintext = decryptBuffer(encryptedData, dek, track.encryptionIv);

    // Verify content integrity — ensures delivered file matches uploaded file
    if (track.contentHash) {
      const downloadHash = computeContentHash(plaintext);
      if (downloadHash !== track.contentHash) {
        logger.error("Content hash mismatch on download", {
          roomId,
          trackId: track.id,
          expected: track.contentHash,
          actual: downloadHash,
        });
        return NextResponse.json({ error: "Content integrity check failed" }, { status: 500 });
      }
    }

    logger.info("Track downloaded", {
      roomId,
      trackId: track.id,
      role: grant.participantRole,
    });

    // Validate stored MIME type — serve as octet-stream if not in allowlist
    const safeContentType = ACCEPTED_MIME_TYPES.includes(track.mimeType)
      ? track.mimeType
      : "application/octet-stream";

    // Build response BEFORE cleanup — user gets the file no matter what
    const response = new Response(new Uint8Array(plaintext), {
      headers: {
        "Content-Type": safeContentType,
        "Content-Disposition": `attachment; filename="${sanitizeFilename(track.originalFilename)}"`,
        "Content-Length": String(plaintext.length),
        "X-Content-Type-Options": "nosniff",
      },
    });

    // Wipe DEK — file is now permanently locked, but .enc remains on disk
    // A cleanup cron will delete orphaned .enc files and artifacts later
    await updateTrack(track.id, { encryptedDek: null, encryptionIv: null });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Download decryption failed", { roomId, trackId: track.id, error: message });
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/["\\\r\n]/g, "_");
}
