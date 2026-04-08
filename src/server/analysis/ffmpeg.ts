/**
 * FFmpeg-based audio analysis utilities.
 *
 * All functions are async and use child_process.spawn for non-blocking I/O.
 * Input is always a plaintext (decrypted) temp file path.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { logger } from "@/lib/logger";

const SPECTROGRAM_SIZE = "1024x256";
const WAVEFORM_POINTS = 800;
const WAVEFORM_SAMPLE_RATE = 8000;
const SNIPPET_DURATION_SECONDS = 30;
const SNIPPET_BITRATE = "128k";
const SNIPPET_SAMPLE_RATE = "44100";
export const BPM_SAMPLE_RATE = 44100;

// Audio tag overlay — place a short voice tag at regular intervals in snippets
const AUDIO_TAG_PATH = join(process.cwd(), "data", "assets", "audio-tag.mp3");
const AUDIO_TAG_INTERVAL_SECONDS = 10;
const AUDIO_TAG_OFFSET_SECONDS = 5;
const AUDIO_TAG_VOLUME = 1.0;

// --- Helpers ---

interface SpawnResult {
  stdout: Buffer;
  stderr: Buffer;
  code: number;
}

function runSpawn(cmd: string, args: string[]): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        code: code ?? 1,
      });
    });
  });
}

// --- Metadata ---

export interface AudioMetadata {
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
}

export async function extractMetadata(filePath: string): Promise<AudioMetadata> {
  const result = await runSpawn("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  const data = JSON.parse(result.stdout.toString()) as {
    format: { duration: string; bit_rate: string };
    streams: Array<{
      codec_name: string;
      sample_rate: string;
      channels: number;
      codec_type: string;
    }>;
  };

  const audioStream = data.streams.find((s) => s.codec_type === "audio");
  if (!audioStream) throw new Error("No audio stream found");

  return {
    duration: parseFloat(data.format.duration),
    bitrate: Math.round(parseInt(data.format.bit_rate, 10) / 1000),
    sampleRate: parseInt(audioStream.sample_rate, 10),
    channels: audioStream.channels,
    codec: audioStream.codec_name,
  };
}

// --- Spectrogram ---

export async function generateSpectrogram(filePath: string, outPath: string): Promise<void> {
  const result = await runSpawn("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-lavfi",
    `showspectrumpic=s=${SPECTROGRAM_SIZE}:mode=combined:color=intensity:scale=log:legend=0`,
    outPath,
  ]);

  if (!existsSync(outPath)) {
    logger.error("Spectrogram generation failed", {
      stderr: result.stderr.toString().slice(0, 500),
    });
    throw new Error("Spectrogram generation failed");
  }
}

// --- PCM Decode (shared: waveform + snippet selection) ---

export async function decodePcmMono(filePath: string, sampleRate: number): Promise<Float32Array> {
  const result = await runSpawn("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-ac",
    "1",
    "-ar",
    String(sampleRate),
    "-f",
    "f32le",
    "-acodec",
    "pcm_f32le",
    "pipe:1",
  ]);

  if (result.code !== 0) throw new Error("PCM decode failed");
  const buf = result.stdout;

  // Copy into aligned ArrayBuffer — Buffer.concat may produce
  // a pooled buffer with byteOffset not aligned to 4 bytes
  const aligned = new ArrayBuffer(buf.byteLength);
  new Uint8Array(aligned).set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return new Float32Array(aligned);
}

/** Decode at 8kHz for waveform. */
export async function decodePcmForWaveform(filePath: string): Promise<Float32Array> {
  return decodePcmMono(filePath, WAVEFORM_SAMPLE_RATE);
}

/** Decode at 44.1kHz for BPM detection. */
export async function decodePcmForBpm(filePath: string): Promise<Float32Array> {
  return decodePcmMono(filePath, BPM_SAMPLE_RATE);
}

// --- Waveform peaks ---

export interface WaveformData {
  points: number;
  duration: number;
  sampleRate: number;
  peaks: number[];
}

export function computeWaveformPeaks(samples: Float32Array, duration: number): WaveformData {
  const chunkSize = Math.max(1, Math.floor(samples.length / WAVEFORM_POINTS));
  const peaks: number[] = [];

  for (let i = 0; i < WAVEFORM_POINTS; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, samples.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(samples[j] ?? 0);
      if (abs > max) max = abs;
    }
    peaks.push(Math.round(max * 1000) / 1000);
  }

  return { points: WAVEFORM_POINTS, duration, sampleRate: WAVEFORM_SAMPLE_RATE, peaks };
}

// --- Loudest segment finder ---

export function findLoudestSegment(samples: Float32Array, sampleRate: number): number {
  const windowSamples = SNIPPET_DURATION_SECONDS * sampleRate;
  if (samples.length <= windowSamples) return 0;

  const hopSamples = sampleRate; // 1-second hops
  let bestStart = 0;
  let bestEnergy = 0;

  for (let start = 0; start + windowSamples <= samples.length; start += hopSamples) {
    let energy = 0;
    for (let i = start; i < start + windowSamples; i++) {
      energy += samples[i] * samples[i];
    }
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestStart = start;
    }
  }

  return Math.floor(bestStart / sampleRate);
}

// --- Audio tag filter ---

/**
 * Build FFmpeg args to overlay an audio tag at regular intervals.
 * Returns empty array when no tag file exists (graceful fallback).
 */
function buildAudioTagFilter(snippetDuration: number): string[] {
  if (!existsSync(AUDIO_TAG_PATH)) return [];

  const tagTimes: number[] = [];
  for (let t = AUDIO_TAG_OFFSET_SECONDS; t < snippetDuration; t += AUDIO_TAG_INTERVAL_SECONDS) {
    tagTimes.push(t);
  }

  if (tagTimes.length === 0) return [];

  const filters: string[] = [];
  filters.push(`[1:a]volume=${AUDIO_TAG_VOLUME}[tag]`);

  if (tagTimes.length === 1) {
    const delayMs = tagTimes[0] * 1000;
    filters.push(`[tag]adelay=${delayMs}:all=1[dtag]`);
    filters.push(`[0:a][dtag]amix=inputs=2:duration=first:dropout_transition=0:normalize=0`);
  } else {
    const splitLabels = tagTimes.map((_, i) => `[t${i}]`).join("");
    filters.push(`[tag]asplit=${tagTimes.length}${splitLabels}`);

    for (let i = 0; i < tagTimes.length; i++) {
      const delayMs = tagTimes[i] * 1000;
      filters.push(`[t${i}]adelay=${delayMs}:all=1[d${i}]`);
    }

    const mixLabels = tagTimes.map((_, i) => `[d${i}]`).join("");
    filters.push(
      `${mixLabels}amix=inputs=${tagTimes.length}:duration=longest:dropout_transition=0:normalize=0[tags]`,
    );
    filters.push(`[0:a][tags]amix=inputs=2:duration=first:dropout_transition=0:normalize=0`);
  }

  logger.info("Audio tag overlay enabled", { placements: tagTimes });
  return ["-i", AUDIO_TAG_PATH, "-filter_complex", filters.join(";")];
}

// --- Snippet generation ---

export async function generateSnippet(
  filePath: string,
  outPath: string,
  startSeconds: number,
  duration: number,
): Promise<void> {
  const snippetDuration = Math.min(SNIPPET_DURATION_SECONDS, duration - startSeconds);
  const tagArgs = buildAudioTagFilter(snippetDuration);

  const result = await runSpawn("ffmpeg", [
    "-y",
    "-ss",
    String(startSeconds),
    "-t",
    String(snippetDuration),
    "-i",
    filePath,
    ...tagArgs,
    "-ab",
    SNIPPET_BITRATE,
    "-ac",
    "2",
    "-ar",
    SNIPPET_SAMPLE_RATE,
    outPath,
  ]);

  if (!existsSync(outPath)) {
    logger.error("Snippet generation failed", { stderr: result.stderr.toString().slice(0, 500) });
    throw new Error("Snippet generation failed");
  }
}
