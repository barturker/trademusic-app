/**
 * BPM detection using music-tempo (pure JS, no native deps).
 */

// @ts-expect-error — music-tempo has no type declarations
import MusicTempo from "music-tempo";

import { logger } from "@/lib/logger";

export interface BpmResult {
  bpm: number;
  confidence: number;
}

/**
 * Detect BPM from PCM audio data.
 * Input must be mono 44.1kHz Float32Array (from decodePcmForBpm).
 */
export function detectBpm(samples: Float32Array): BpmResult {
  try {
    const mt = new MusicTempo(samples) as {
      tempo: number;
      beats: number[];
      tempoConfidence?: number;
    };

    return {
      bpm: Math.round(mt.tempo),
      confidence: Math.round((mt.tempoConfidence ?? 0) * 100),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn("BPM detection failed, using fallback", { error: message });
    return { bpm: 0, confidence: 0 };
  }
}
