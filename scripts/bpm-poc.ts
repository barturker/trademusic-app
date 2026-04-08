/**
 * PoC: BPM detection with music-tempo (pure JS)
 *
 * Usage: npx tsx scripts/bpm-poc.ts <audio-file>
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

// @ts-expect-error — music-tempo has no types
import MusicTempo from "music-tempo";

const inputFile = process.argv[2];

if (!inputFile) {
  console.error("Usage: npx tsx scripts/bpm-poc.ts <audio-file>");
  process.exit(1);
}

const filePath = resolve(inputFile);

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`\nAnalyzing: ${basename(filePath)}\n`);

// 1. Decode to mono 44.1kHz float32 PCM via FFmpeg
console.log("1/2 Decoding audio with FFmpeg...");
const result = spawnSync(
  "ffmpeg",
  [
    "-i", filePath,
    "-ac", "1",
    "-ar", "44100",
    "-f", "f32le",
    "-acodec", "pcm_f32le",
    "pipe:1",
  ],
  { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 200 * 1024 * 1024 },
);

if (result.error) {
  console.error("FFmpeg decode failed:", result.error);
  process.exit(1);
}

const rawBuffer = result.stdout as Buffer;
const audioData = new Float32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);
const durationSec = audioData.length / 44100;
const mins = Math.floor(durationSec / 60);
const secs = Math.round(durationSec % 60);

console.log(`     Duration: ${mins}:${String(secs).padStart(2, "0")} (${audioData.length} samples)`);

// 2. BPM Detection
console.log("\n2/2 Detecting BPM...");

const mt = new MusicTempo(audioData);
const bpm = Math.round(mt.tempo * 10) / 10;
const beats: number[] = mt.beats;
const beatCount = beats.length;

console.log(`\n━━━ Results ━━━`);
console.log(`     BPM:         ${bpm}`);
console.log(`     Beats found: ${beatCount}`);
console.log(`     First beat:  ${beats[0]?.toFixed(2) ?? "N/A"}s`);
console.log(`     Confidence:  ${mt.tempoConfidence?.toFixed(2) ?? "N/A"}`);
console.log();
