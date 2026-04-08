/**
 * Frequency cutoff detection for lossy audio quality assessment.
 *
 * Uses FFT spectral analysis to detect where meaningful frequency content
 * stops, indicating the effective quality of the audio source.
 */

import { logger } from "@/lib/logger";

// --- Constants ---

const FFT_SIZE = 4096;
const HOP_SIZE = 2048;
const DEFAULT_SAMPLE_RATE = 44100;

/** Reference frequency range for energy baseline (1kHz - 8kHz). */
const REF_LOW_HZ = 1000;
const REF_HIGH_HZ = 8000;

/** Energy must drop below this level (dB relative to reference) to be considered cut off. */
const CUTOFF_THRESHOLD_DB = -30;

/** Smoothing window for spectrum bins (reduces noise in detection). */
const SMOOTHING_BINS = 8;

/** Max FFT windows to analyze (performance guard for long files). */
const MAX_WINDOWS = 512;

// --- Quality verdict types ---

export interface FrequencyCutoff {
  hz: number;
  label: string;
  description: string;
}

const QUALITY_THRESHOLDS: ReadonlyArray<{
  minHz: number;
  label: string;
  description: string;
}> = [
  { minHz: 21000, label: "Lossless", description: "Genuine lossless" },
  { minHz: 20000, label: "High", description: "~320kbps+" },
  { minHz: 19000, label: "Good", description: "~256kbps" },
  { minHz: 18000, label: "Medium", description: "~192kbps" },
  { minHz: 16000, label: "Low", description: "~128kbps" },
  { minHz: 0, label: "Very Low", description: "<128kbps" },
];

// --- FFT (Radix-2 Cooley-Tukey, in-place) ---

function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      let tmp = real[i];
      real[i] = real[j];
      real[j] = tmp;
      tmp = imag[i];
      imag[i] = imag[j];
      imag[j] = tmp;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len *= 2) {
    const halfLen = len / 2;
    const angle = (-2 * Math.PI) / len;
    const wR = Math.cos(angle);
    const wI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let cR = 1;
      let cI = 0;
      for (let j = 0; j < halfLen; j++) {
        const uR = real[i + j];
        const uI = imag[i + j];
        const vR = real[i + j + halfLen] * cR - imag[i + j + halfLen] * cI;
        const vI = real[i + j + halfLen] * cI + imag[i + j + halfLen] * cR;

        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + halfLen] = uR - vR;
        imag[i + j + halfLen] = uI - vI;

        const newCR = cR * wR - cI * wI;
        cI = cR * wI + cI * wR;
        cR = newCR;
      }
    }
  }
}

// --- Hann window ---

function createHannWindow(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

// --- Spectrum analysis ---

function computeAverageSpectrum(samples: Float32Array): Float64Array {
  const hannWindow = createHannWindow(FFT_SIZE);
  const halfFFT = FFT_SIZE / 2;
  const spectrum = new Float64Array(halfFFT);
  let windowCount = 0;

  for (
    let offset = 0;
    offset + FFT_SIZE <= samples.length && windowCount < MAX_WINDOWS;
    offset += HOP_SIZE
  ) {
    const real = new Float64Array(FFT_SIZE);
    const imag = new Float64Array(FFT_SIZE);

    for (let i = 0; i < FFT_SIZE; i++) {
      real[i] = (samples[offset + i] ?? 0) * hannWindow[i];
    }

    fft(real, imag);

    for (let i = 0; i < halfFFT; i++) {
      spectrum[i] += Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }
    windowCount++;
  }

  if (windowCount > 0) {
    for (let i = 0; i < halfFFT; i++) {
      spectrum[i] /= windowCount;
    }
  }

  return spectrum;
}

function smoothSpectrum(spectrum: Float64Array): Float64Array {
  const smoothed = new Float64Array(spectrum.length);
  const halfWin = Math.floor(SMOOTHING_BINS / 2);

  for (let i = 0; i < spectrum.length; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(spectrum.length - 1, i + halfWin);
    for (let j = lo; j <= hi; j++) {
      sum += spectrum[j];
      count++;
    }
    smoothed[i] = sum / count;
  }

  return smoothed;
}

// --- Cutoff detection ---

function findCutoffFrequency(spectrum: Float64Array, sampleRate: number): number {
  const binHz = sampleRate / FFT_SIZE;
  const halfFFT = spectrum.length;
  const smoothed = smoothSpectrum(spectrum);

  // Compute reference energy (average of 1kHz - 8kHz range)
  const refLowBin = Math.floor(REF_LOW_HZ / binHz);
  const refHighBin = Math.min(Math.floor(REF_HIGH_HZ / binHz), halfFFT - 1);
  let refSum = 0;
  let refCount = 0;
  for (let i = refLowBin; i <= refHighBin; i++) {
    refSum += smoothed[i];
    refCount++;
  }
  const refLevel = refCount > 0 ? refSum / refCount : 1;

  // Silence guard
  if (refLevel === 0) return sampleRate / 2;

  // Convert dB threshold to linear ratio
  const thresholdLinear = refLevel * Math.pow(10, CUTOFF_THRESHOLD_DB / 20);

  // Scan from Nyquist downward — find where energy first exceeds threshold
  const nyquistBin = halfFFT - 1;
  for (let i = nyquistBin; i >= 0; i--) {
    if (smoothed[i] > thresholdLinear) {
      return Math.round(i * binHz);
    }
  }

  return 0;
}

// --- Dynamic range analysis ---

export interface DynamicRange {
  peakDb: number;
  rmsDb: number;
  crestFactor: number;
}

/**
 * Compute peak level, RMS level, and crest factor from PCM samples.
 * All values in dBFS (decibels relative to full scale).
 */
export function computeDynamicRange(samples: Float32Array): DynamicRange | null {
  if (samples.length === 0) return null;

  let peak = 0;
  let sumSquares = 0;

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
    sumSquares += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sumSquares / samples.length);

  // Guard against silence
  if (peak === 0) return { peakDb: -Infinity, rmsDb: -Infinity, crestFactor: 0 };

  const peakDb = Math.round(20 * Math.log10(peak) * 10) / 10;
  const rmsDb = Math.round(20 * Math.log10(rms) * 10) / 10;
  const crestFactor = Math.round((peakDb - rmsDb) * 10) / 10;

  return { peakDb, rmsDb, crestFactor };
}

// --- Public API ---

/**
 * Detect the effective frequency cutoff of an audio signal.
 * Accepts PCM samples decoded at the given sample rate (mono).
 */
export function detectFrequencyCutoff(
  samples: Float32Array,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): FrequencyCutoff | null {
  if (samples.length < FFT_SIZE) {
    logger.warn("Audio too short for frequency cutoff detection", {
      samples: samples.length,
      required: FFT_SIZE,
    });
    return null;
  }

  const spectrum = computeAverageSpectrum(samples);
  const cutoffHz = findCutoffFrequency(spectrum, sampleRate);

  const verdict = QUALITY_THRESHOLDS.find((t) => cutoffHz >= t.minHz);
  if (!verdict) return null;

  logger.info("Frequency cutoff detected", { cutoffHz, label: verdict.label });

  return {
    hz: cutoffHz,
    label: verdict.label,
    description: verdict.description,
  };
}
