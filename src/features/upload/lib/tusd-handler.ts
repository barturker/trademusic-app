/**
 * Extracted tusd webhook business logic.
 *
 * This module contains the core handlers for tusd webhook events
 * (pre-create, post-finish). The route handler in src/app/ delegates
 * to these functions after validating the webhook secret.
 */

import { readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { NextResponse } from "next/server";

import { computeContentHash, generateId } from "@/lib/crypto";
import { encryptBuffer, generateDek, generateIv, wrapDek } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { notifyRoom } from "@/lib/socket-emitter";
import { verifyUploadToken } from "@/lib/upload-token";
import { findRoomById } from "@/server/room-repository";
import { countTracksByRoomAndRole, insertTrackIfUnderLimit } from "@/server/track-repository";
import { boss, DEFAULT_QUEUE_OPTIONS, ensureBossStarted } from "@/server/pg-boss";
import { ACCEPTED_MIME_TYPES, AUDIO_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_TRACKS_PER_ROLE } from "@/features/upload/constants";

import type { TusdHookPayload } from "@/features/upload/types";
import type { ParticipantRole } from "@/types/room";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./data/uploads";
const FALLBACK_MIME_TYPE = "application/octet-stream";

/** Regex for valid tusd upload IDs (hex digits with optional hyphens/plus). */
const UPLOAD_ID_PATTERN = /^[a-f0-9][a-f0-9+\-]*$/i;

const UPLOAD_ELIGIBLE_STATUSES: string[] = [
  "created",
  "waiting_for_peer",
  "processing",
  "ready_for_review",
  "a_approved",
  "b_approved",
];

interface WebhookMetadata {
  roomId: string;
  uploadToken: string;
  filename: string;
  filetype: string;
}

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function parseMetadata(raw: Record<string, string>): WebhookMetadata | null {
  const roomId = raw["roomId"] ?? raw["roomid"];
  const uploadToken = raw["uploadToken"] ?? raw["uploadtoken"];
  const filename = raw["filename"] ?? raw["name"];
  const filetype = raw["filetype"] ?? raw["type"] ?? "";

  if (!roomId || !uploadToken || !filename) return null;
  return { roomId, uploadToken, filename, filetype };
}

/** Validate upload ID format and ensure resolved path stays within UPLOAD_DIR. */
function validateUploadPath(uploadId: string): string | null {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) return null;

  const resolvedBase = resolve(UPLOAD_DIR);
  const resolvedPath = resolve(UPLOAD_DIR, uploadId);

  if (!resolvedPath.startsWith(resolvedBase + "/") && resolvedPath !== resolvedBase) {
    return null;
  }

  return resolvedPath;
}

/** Validate MIME type against accepted audio types, fallback to octet-stream. */
function sanitizeMimeType(filetype: string): string {
  if (!filetype) return FALLBACK_MIME_TYPE;
  if (ACCEPTED_MIME_TYPES.includes(filetype)) return filetype;
  return FALLBACK_MIME_TYPE;
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may not exist, ignore
  }
}

/** Handle tusd pre-create hook — validates upload before it begins. */
export async function handlePreCreate(payload: TusdHookPayload): Promise<NextResponse> {
  const upload = payload.Event.Upload;
  const meta = parseMetadata(upload.MetaData);

  if (!meta) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 400, Body: "Missing required metadata" } },
      { status: 200 },
    );
  }

  if (upload.Size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 413, Body: "File too large (max 150MB)" } },
      { status: 200 },
    );
  }

  const ext = getExtension(meta.filename);
  if (!AUDIO_EXTENSIONS.includes(ext as (typeof AUDIO_EXTENSIONS)[number])) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 415, Body: "Unsupported audio format" } },
      { status: 200 },
    );
  }

  const suppliedType = meta.filetype;
  if (suppliedType && !ACCEPTED_MIME_TYPES.includes(suppliedType)) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 415, Body: "Unsupported MIME type" } },
      { status: 200 },
    );
  }

  const tokenPayload = verifyUploadToken(meta.uploadToken);
  if (!tokenPayload) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 401, Body: "Invalid or expired upload token" } },
      { status: 200 },
    );
  }

  if (tokenPayload.roomId !== meta.roomId) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 403, Body: "Token does not match room" } },
      { status: 200 },
    );
  }

  const room = await findRoomById(meta.roomId);
  if (!room) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 404, Body: "Room not found" } },
      { status: 200 },
    );
  }

  if (!UPLOAD_ELIGIBLE_STATUSES.includes(room.status)) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 403, Body: "Room is not accepting uploads" } },
      { status: 200 },
    );
  }

  const trackCount = await countTracksByRoomAndRole(meta.roomId, tokenPayload.role);
  if (trackCount >= MAX_TRACKS_PER_ROLE) {
    return NextResponse.json(
      { RejectUpload: true, HTTPResponse: { StatusCode: 403, Body: "Track limit reached (max 5 per participant)" } },
      { status: 200 },
    );
  }

  logger.info("Upload pre-create accepted", {
    roomId: meta.roomId,
    role: tokenPayload.role,
    filename: meta.filename,
    size: upload.Size,
  });

  return NextResponse.json({}, { status: 200 });
}

/** Handle tusd post-finish hook — encrypts file, stores track, enqueues analysis. */
export async function handlePostFinish(payload: TusdHookPayload): Promise<NextResponse> {
  const upload = payload.Event.Upload;
  const meta = parseMetadata(upload.MetaData);

  if (!meta) {
    logger.error("Post-finish missing metadata", { uploadId: upload.ID });
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const tokenPayload = verifyUploadToken(meta.uploadToken);
  if (!tokenPayload || tokenPayload.roomId !== meta.roomId) {
    logger.error("Post-finish invalid upload token", { uploadId: upload.ID });
    return NextResponse.json({ error: "Invalid upload token" }, { status: 401 });
  }

  const role = tokenPayload.role;

  const uploadPath = validateUploadPath(upload.ID);
  if (!uploadPath) {
    logger.error("Invalid upload ID rejected", { uploadId: upload.ID });
    return NextResponse.json({ error: "Invalid upload identifier" }, { status: 400 });
  }

  let plaintext: Buffer;
  try {
    plaintext = await readFile(uploadPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Failed to read uploaded file", { uploadId: upload.ID, error: message });
    return NextResponse.json({ error: "File not found" }, { status: 500 });
  }

  const contentHash = computeContentHash(plaintext);

  const dek = generateDek();
  const iv = generateIv();
  const encrypted = encryptBuffer(plaintext, dek, iv);
  const { wrappedDek, wrapIv } = wrapDek(dek);

  const trackId = generateId();

  const encryptedFilename = `${trackId}.enc`;
  const encryptedPath = join(UPLOAD_DIR, encryptedFilename);

  await writeFile(encryptedPath, encrypted);

  const safeMimeType = sanitizeMimeType(meta.filetype);

  const inserted = await insertTrackIfUnderLimit(
    {
      id: trackId,
      roomId: meta.roomId,
      role: role as ParticipantRole,
      originalFilename: meta.filename,
      storedFilename: encryptedFilename,
      fileSizeBytes: upload.Size,
      mimeType: safeMimeType,
      contentHash,
      durationSeconds: null,
      bitrateKbps: null,
      sampleRateHz: null,
      codec: null,
      bpm: null,
      bpmConfidence: null,
      spectrogramPath: null,
      waveformJsonPath: null,
      snippetPath: null,
      encryptedDek: `${wrappedDek}:${wrapIv}`,
      encryptionIv: iv.toString("hex"),
      processingStatus: "pending",
      processingError: null,
      uploadedAt: new Date(),
      processedAt: null,
    },
    MAX_TRACKS_PER_ROLE,
  );

  if (!inserted) {
    await safeUnlink(encryptedPath);
    return NextResponse.json({ error: "Track limit reached" }, { status: 403 });
  }

  await safeUnlink(uploadPath);
  await safeUnlink(`${uploadPath}.info`);

  try {
    await ensureBossStarted();
    await boss.send("track-analysis", { trackId, roomId: meta.roomId }, DEFAULT_QUEUE_OPTIONS);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("Failed to enqueue analysis job", { trackId, error: message });
  }

  logger.info("Upload post-finish complete", {
    trackId,
    roomId: meta.roomId,
    role,
    originalFilename: meta.filename,
  });

  notifyRoom(meta.roomId);
  return NextResponse.json({ trackId }, { status: 200 });
}
