/**
 * PoC: Audio analysis with FFmpeg
 *
 * Usage: npx tsx scripts/analyze-poc.ts <audio-file>
 *
 * Outputs:
 *   - scripts/output/spectrogram.png
 *   - scripts/output/waveform.json
 *   - scripts/output/metadata.json
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "output");
const SPECTROGRAM_SIZE = "1024x256";
const WAVEFORM_POINTS = 800;

// --- Helpers ---

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
}

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// --- FFprobe: extract metadata ---

interface AudioMetadata {
  filename: string;
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
  format: string;
}

function extractMetadata(filePath: string): AudioMetadata {
  const json = run(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
  );
  const data = JSON.parse(json) as {
    format: { filename: string; duration: string; bit_rate: string; format_name: string };
    streams: Array<{ codec_name: string; sample_rate: string; channels: number; codec_type: string }>;
  };

  const audioStream = data.streams.find((s) => s.codec_type === "audio");
  if (!audioStream) throw new Error("No audio stream found");

  return {
    filename: basename(filePath),
    duration: parseFloat(data.format.duration),
    bitrate: Math.round(parseInt(data.format.bit_rate, 10) / 1000),
    sampleRate: parseInt(audioStream.sample_rate, 10),
    channels: audioStream.channels,
    codec: audioStream.codec_name,
    format: data.format.format_name,
  };
}

// --- Spectrogram generation ---

function generateSpectrogram(filePath: string): string {
  const outPath = resolve(OUTPUT_DIR, "spectrogram.png");

  spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", filePath,
      "-lavfi", `showspectrumpic=s=${SPECTROGRAM_SIZE}:mode=combined:color=intensity:scale=log:legend=0`,
      outPath,
    ],
    { stdio: "pipe" },
  );

  if (!existsSync(outPath)) throw new Error("Spectrogram generation failed");
  return outPath;
}

// --- Decode raw PCM (shared by waveform + snippet) ---

const WAVEFORM_SAMPLE_RATE = 8000;

function decodePcm(filePath: string): Float32Array {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", filePath,
      "-ac", "1",
      "-ar", String(WAVEFORM_SAMPLE_RATE),
      "-f", "f32le",
      "-acodec", "pcm_f32le",
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 50 * 1024 * 1024 },
  );

  if (result.error) throw result.error;

  const rawBuffer = result.stdout as Buffer;
  return new Float32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);
}

// --- Find loudest segment (RMS energy sliding window) ---

const SNIPPET_DURATION = 30;

function findLoudestSegment(samples: Float32Array, sampleRate: number): number {
  const windowSamples = SNIPPET_DURATION * sampleRate;
  if (samples.length <= windowSamples) return 0;

  const hopSamples = sampleRate; // slide by 1 second
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

// --- Waveform generation (peaks) ---

function generateWaveform(filePath: string, duration: number, samples: Float32Array): string {
  const outPath = resolve(OUTPUT_DIR, "waveform.json");

  const _ = filePath; // filePath kept for signature consistency

  // Downsample to WAVEFORM_POINTS peaks
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

  const waveformData = {
    points: WAVEFORM_POINTS,
    duration,
    sampleRate: 8000,
    peaks,
  };

  writeFileSync(outPath, JSON.stringify(waveformData, null, 2));
  return outPath;
}

// --- LUFS Loudness measurement ---

interface LoudnessResult {
  integratedLufs: number;
  truePeakDbtp: number;
  lra: number;
}

function measureLoudness(filePath: string): LoudnessResult {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", filePath,
      "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-f", "null",
      "-",
    ],
    { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" },
  );

  const stderr = (result.stderr ?? "") as string;

  // Parse the JSON block from stderr
  const jsonMatch = stderr.match(/\{[\s\S]*"input_i"[\s\S]*?\}/);
  if (!jsonMatch) {
    return { integratedLufs: 0, truePeakDbtp: 0, lra: 0 };
  }

  const data = JSON.parse(jsonMatch[0]) as Record<string, string>;

  return {
    integratedLufs: parseFloat(data.input_i ?? "0"),
    truePeakDbtp: parseFloat(data.input_tp ?? "0"),
    lra: parseFloat(data.input_lra ?? "0"),
  };
}

// --- Transcode detection (band comparison) ---

type QualityVerdict = "good_quality" | "possible_rip";

interface TranscodeResult {
  verdict: QualityVerdict;
  shelfRatio: number;
  cutoffHz: number;
}

const ANALYSIS_SAMPLE_RATE = 44100;
const CLIFF_THRESHOLD = 0.1; // if adjacent band drops to <10% of previous → cliff detected

function decodeBand(filePath: string, lowHz: number, highHz: number): Float32Array {
  const filters = [];
  if (lowHz > 0) filters.push(`highpass=f=${lowHz}`);
  if (highHz < ANALYSIS_SAMPLE_RATE / 2) filters.push(`lowpass=f=${highHz}`);
  const af = filters.length > 0 ? ["-af", filters.join(",")] : [];

  const result = spawnSync(
    "ffmpeg",
    [
      "-y", "-i", filePath,
      ...af,
      "-ac", "1", "-ar", String(ANALYSIS_SAMPLE_RATE),
      "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"], maxBuffer: 200 * 1024 * 1024 },
  );

  if (result.error) return new Float32Array(0);
  const buf = result.stdout as Buffer;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function rmsEnergy(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return samples.length > 0 ? sum / samples.length : 0;
}

function detectTranscode(filePath: string): TranscodeResult {
  // Measure energy in 2kHz bands from 12kHz to 22kHz
  // Natural rolloff = gradual decrease between adjacent bands
  // Lossy shelf = sudden cliff (band drops to <10% of previous)
  const bands = [
    { low: 12000, high: 14000 },
    { low: 14000, high: 16000 },
    { low: 16000, high: 18000 },
    { low: 18000, high: 20000 },
    { low: 20000, high: 22000 },
  ];

  const energies: number[] = [];
  for (const band of bands) {
    const samples = decodeBand(filePath, band.low, band.high);
    energies.push(rmsEnergy(samples));
  }

  // Find cliff — where energy drops to <10% of previous band
  let cutoffHz = ANALYSIS_SAMPLE_RATE / 2;
  let cliffDetected = false;
  let cliffRatio = 1;

  for (let i = 1; i < energies.length; i++) {
    const prev = energies[i - 1];
    const curr = energies[i];
    const dropRatio = prev > 0 ? curr / prev : 0;

    if (dropRatio < CLIFF_THRESHOLD && prev > 0) {
      cutoffHz = bands[i].low;
      cliffDetected = true;
      cliffRatio = Math.round(dropRatio * 10000) / 10000;
      break;
    }
  }

  // Also compute overall shelf ratio for reporting
  const midEnergy = energies[0]; // 12-14 kHz
  const highEnergy = energies[3]; // 18-20 kHz
  const shelfRatio = midEnergy > 0 ? highEnergy / midEnergy : 0;

  // Only flag as rip if cliff is below 17kHz
  // 20kHz+ cliff = normal Nyquist rolloff for 44.1kHz audio
  // 18-19kHz cliff = high bitrate lossy, still acceptable
  // <17kHz cliff = low bitrate lossy or bad rip
  const RIP_CUTOFF_THRESHOLD = 17000;
  const verdict: QualityVerdict = cliffDetected && cutoffHz < RIP_CUTOFF_THRESHOLD ? "possible_rip" : "good_quality";

  return {
    verdict,
    shelfRatio: Math.round(shelfRatio * 10000) / 10000,
    cutoffHz,
  };
}

// --- Snippet generation ---

function generateSnippet(filePath: string, duration: number, snippetStart: number): string {
  const outPath = resolve(OUTPUT_DIR, "snippet.mp3");
  const startTime = snippetStart;
  const snippetDuration = Math.min(SNIPPET_DURATION, duration - startTime);

  spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", filePath,
      "-ss", String(startTime),
      "-t", String(snippetDuration),
      "-ab", "128k",
      "-ac", "2",
      "-ar", "44100",
      outPath,
    ],
    { stdio: "pipe" },
  );

  if (!existsSync(outPath)) throw new Error("Snippet generation failed");
  return outPath;
}

// --- Main ---

const inputFile = process.argv[2];

if (!inputFile) {
  console.error("Usage: npx tsx scripts/analyze-poc.ts <audio-file>");
  process.exit(1);
}

const filePath = resolve(inputFile);

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

ensureOutputDir();

console.log(`\nAnalyzing: ${basename(filePath)}\n`);

// 1. Metadata
console.log("1/4 Extracting metadata...");
const metadata = extractMetadata(filePath);
writeFileSync(resolve(OUTPUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));
const mins = Math.floor(metadata.duration / 60);
const secs = Math.round(metadata.duration % 60);
const sampleKhz = (metadata.sampleRate / 1000).toFixed(1);
console.log(`     Duration: ${mins}:${String(secs).padStart(2, "0")}`);
console.log(`     Bitrate:  ${metadata.bitrate} kbps`);
console.log(`     Sample:   ${sampleKhz} kHz`);
console.log(`     Codec:    ${metadata.codec}`);
console.log(`     Channels: ${metadata.channels === 2 ? "Stereo" : metadata.channels === 1 ? "Mono" : metadata.channels}`);

// 2. LUFS Loudness
console.log("\n2/7 Measuring loudness...");
const loudness = measureLoudness(filePath);
console.log(`     Integrated: ${loudness.integratedLufs.toFixed(1)} LUFS`);
console.log(`     True Peak:  ${loudness.truePeakDbtp.toFixed(1)} dBTP`);
console.log(`     LRA:        ${loudness.lra.toFixed(1)} LU`);

// 3. Transcode detection
console.log("\n3/7 Detecting transcode...");
const transcode = detectTranscode(filePath);
const verdictEmoji = transcode.verdict === "good_quality" ? "GOOD" : "RIP?";
console.log(`     Verdict:    ${verdictEmoji} (${transcode.verdict})`);
console.log(`     Shelf ratio: ${transcode.shelfRatio} (cliff threshold: ${CLIFF_THRESHOLD})`);
console.log(`     Cutoff:     ${transcode.cutoffHz >= 22050 ? "none (full bandwidth)" : transcode.cutoffHz + " Hz"}`);

// 4. Decode PCM (shared for waveform + loudest segment)
console.log("\n4/7 Decoding audio...");
const samples = decodePcm(filePath);
console.log(`     Samples: ${samples.length} (${WAVEFORM_SAMPLE_RATE} Hz mono)`);

// 5. Spectrogram
console.log("\n5/7 Generating spectrogram...");
const specPath = generateSpectrogram(filePath);
console.log(`     Saved: ${specPath}`);

// 6. Waveform
console.log("\n6/7 Generating waveform...");
const wavePath = generateWaveform(filePath, metadata.duration, samples);
console.log(`     Saved: ${wavePath} (${WAVEFORM_POINTS} peaks)`);

// 7. Smart Snippet (loudest 30s segment)
console.log("\n7/7 Finding loudest segment + generating snippet...");
const snippetStart = findLoudestSegment(samples, WAVEFORM_SAMPLE_RATE);
const snippetEnd = snippetStart + SNIPPET_DURATION;
const snipStartMin = Math.floor(snippetStart / 60);
const snipStartSec = snippetStart % 60;
const snipEndMin = Math.floor(snippetEnd / 60);
const snipEndSec = snippetEnd % 60;
console.log(`     Loudest segment: ${snipStartMin}:${String(snipStartSec).padStart(2, "0")} – ${snipEndMin}:${String(snipEndSec).padStart(2, "0")}`);
const snippetPath = generateSnippet(filePath, metadata.duration, snippetStart);
console.log(`     Saved: ${snippetPath}`);

// Write analysis results for viewer
const analysisData = {
  ...metadata,
  loudness,
  transcode,
  snippet: { start: snippetStart, duration: SNIPPET_DURATION },
};
writeFileSync(resolve(OUTPUT_DIR, "metadata.json"), JSON.stringify(analysisData, null, 2));
writeFileSync(
  resolve(OUTPUT_DIR, "snippet-info.json"),
  JSON.stringify({ start: snippetStart, duration: SNIPPET_DURATION }, null, 2),
);

console.log("\nDone! Check scripts/output/ for results.\n");
