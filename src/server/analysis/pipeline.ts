/**
 * Analysis pipeline orchestrator.
 *
 * Decrypt → analyze (metadata, spectrogram, waveform, snippet, BPM)
 * → write artifacts → update track → check room transition.
 */

import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { decryptBuffer, unwrapDek } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { transition } from "@/lib/room-machine";
import { notifyAnalysisProgress, notifyRoom } from "@/lib/socket-emitter";
import { findRoomById, transitionRoomStatusAtomic } from "@/server/room-repository";
import { findTrackById, findTracksByRoomId, updateTrack } from "@/server/track-repository";

import { detectBpm } from "./bpm";
import {
  extractMetadata,
  generateSpectrogram,
  decodePcmForWaveform,
  decodePcmForBpm,
  computeWaveformPeaks,
  findLoudestSegment,
  generateSnippet,
  BPM_SAMPLE_RATE,
} from "./ffmpeg";
import { computeDynamicRange, detectFrequencyCutoff } from "./frequency-cutoff";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./data/uploads";
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR ?? "./data/artifacts";

/** Run the full analysis pipeline for a single track. */
export async function runAnalysisPipeline(trackId: string, roomId: string): Promise<void> {
  const track = await findTrackById(trackId);
  if (!track) throw new Error(`Track not found: ${trackId}`);

  // Mark track as processing
  await updateTrack(trackId, { processingStatus: "processing" });

  // Atomic transition: only succeeds if room is still waiting_for_peer (prevents cancelled room resurrection)
  const room = await findRoomById(roomId);
  if (room && room.status === "waiting_for_peer") {
    const newStatus = transition(room.status, "processing");
    if (newStatus) {
      const updated = await transitionRoomStatusAtomic(roomId, room.status, { status: newStatus });
      if (!updated) {
        logger.warn("Room status transition race detected (waiting_for_peer → processing)", { roomId });
      }
    }
  }

  let tempPath: string | null = null;

  try {
    // --- Decrypt ---
    const encryptedPath = join(UPLOAD_DIR, track.storedFilename);
    const encryptedData = await readFile(encryptedPath);

    const dekParts = track.encryptedDek?.split(":") ?? [];
    if (dekParts.length !== 2 || !track.encryptionIv) {
      throw new Error("Missing encryption metadata");
    }
    const [wrappedDek, wrapIv] = dekParts;
    const dek = unwrapDek(wrappedDek, wrapIv);
    const plaintext = decryptBuffer(encryptedData, dek, track.encryptionIv);

    // Write decrypted temp file
    tempPath = join(UPLOAD_DIR, `${trackId}.tmp`);
    await writeFile(tempPath, plaintext);

    // --- Artifacts directory ---
    const artifactDir = join(ARTIFACTS_DIR, trackId);
    await mkdir(artifactDir, { recursive: true });

    // --- 1. Metadata ---
    logger.info("Analysis: extracting metadata", { trackId });
    await notifyAnalysisProgress(roomId, trackId, "Extracting metadata", 10);
    const metadata = await extractMetadata(tempPath);
    await notifyAnalysisProgress(roomId, trackId, "Metadata extracted", 20);

    // --- 2. Spectrogram ---
    logger.info("Analysis: generating spectrogram", { trackId });
    await notifyAnalysisProgress(roomId, trackId, "Generating spectrogram", 25);
    const spectrogramPath = join(artifactDir, "spectrogram.png");
    await generateSpectrogram(tempPath, spectrogramPath);
    await notifyAnalysisProgress(roomId, trackId, "Spectrogram ready", 40);

    // --- 3. Waveform ---
    logger.info("Analysis: generating waveform", { trackId });
    await notifyAnalysisProgress(roomId, trackId, "Generating waveform", 45);
    const waveformSamples = await decodePcmForWaveform(tempPath);
    const waveformData = computeWaveformPeaks(waveformSamples, metadata.duration);
    const waveformPath = join(artifactDir, "waveform.json");
    await writeFile(waveformPath, JSON.stringify(waveformData));
    await notifyAnalysisProgress(roomId, trackId, "Waveform ready", 55);

    // --- 4. Snippet ---
    logger.info("Analysis: generating snippet", { trackId });
    await notifyAnalysisProgress(roomId, trackId, "Generating snippet", 60);
    const snippetStart = findLoudestSegment(waveformSamples, 8000);
    const snippetPath = join(artifactDir, "snippet.mp3");
    await generateSnippet(tempPath, snippetPath, snippetStart, metadata.duration);
    await notifyAnalysisProgress(roomId, trackId, "Snippet ready", 75);

    // --- 5. BPM ---
    logger.info("Analysis: detecting BPM", { trackId });
    await notifyAnalysisProgress(roomId, trackId, "Detecting BPM", 75);
    const bpmSamples = await decodePcmForBpm(tempPath);
    const bpmResult = detectBpm(bpmSamples);
    await notifyAnalysisProgress(roomId, trackId, "BPM detected", 85);

    // --- 6. Frequency cutoff + dynamic range ---
    logger.info("Analysis: detecting frequency cutoff", { trackId });
    await notifyAnalysisProgress(roomId, trackId, "Analyzing frequency content", 88);
    const frequencyCutoff = detectFrequencyCutoff(bpmSamples, BPM_SAMPLE_RATE);
    const dynamicRange = computeDynamicRange(bpmSamples);
    await notifyAnalysisProgress(roomId, trackId, "Frequency analysis complete", 95);

    // --- 7. Analysis metadata (for viewer) ---
    const snippetDuration = Math.min(30, metadata.duration - snippetStart);
    const analysisMeta = {
      duration: metadata.duration,
      snippet: { start: snippetStart, duration: snippetDuration },
      frequencyCutoff,
      dynamicRange,
    };
    await writeFile(join(artifactDir, "analysis-meta.json"), JSON.stringify(analysisMeta));

    // --- Update track with results ---
    await updateTrack(trackId, {
      durationSeconds: Math.round(metadata.duration),
      bitrateKbps: metadata.bitrate,
      sampleRateHz: metadata.sampleRate,
      codec: metadata.codec,
      bpm: bpmResult.bpm,
      bpmConfidence: bpmResult.confidence,
      spectrogramPath,
      waveformJsonPath: waveformPath,
      snippetPath,
      processingStatus: "completed",
      processedAt: new Date(),
    });

    logger.info("Analysis complete", {
      trackId,
      duration: metadata.duration,
      bpm: bpmResult.bpm,
      codec: metadata.codec,
    });

    notifyRoom(roomId);

    // --- Check room transition ---
    await checkRoomReady(roomId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Analysis failed", { trackId, error: message });
    await updateTrack(trackId, {
      processingStatus: "failed",
      processingError: message,
    });
  } finally {
    // Clean up temp file
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check if all tracks for a room are analyzed.
 * If yes, transition room to ready_for_review.
 */
async function checkRoomReady(roomId: string): Promise<void> {
  const room = await findRoomById(roomId);
  if (!room || room.status !== "processing") return;

  const tracks = await findTracksByRoomId(roomId);
  const hasCreator = tracks.some((t) => t.role === "creator");
  const hasJoiner = tracks.some((t) => t.role === "joiner");
  if (!hasCreator || !hasJoiner) return;

  const allCompleted = tracks.every((t) => t.processingStatus === "completed");
  if (!allCompleted) return;

  const newStatus = transition(room.status, "ready_for_review");
  if (newStatus) {
    // Atomic transition: prevents double-trigger when concurrent tracks complete simultaneously
    const updated = await transitionRoomStatusAtomic(roomId, room.status, { status: newStatus });
    if (updated) {
      logger.info("Room ready for review", { roomId });
    } else {
      logger.warn("Room status transition race detected (processing → ready_for_review)", { roomId });
    }
  }
}
