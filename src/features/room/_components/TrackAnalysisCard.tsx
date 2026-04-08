"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Track } from "@/types/room";

import { SpectrogramSection } from "./SpectrogramSection";
import { WaveformPlayer } from "./WaveformPlayer";

interface AnalysisProgress {
  trackId: string;
  step: string;
  progress: number;
}

interface TrackAnalysisCardProps {
  track: Track;
  progress?: AnalysisProgress;
}

export interface DynamicRangeData {
  peakDb: number;
  rmsDb: number;
  crestFactor: number;
}

export interface AnalysisMeta {
  duration: number;
  snippet: { start: number; duration: number };
  frequencyCutoff?: { hz: number };
  dynamicRange?: DynamicRangeData;
}

const TOKEN_REFRESH_MS = 50 * 60 * 1000;

function formatDuration(seconds: number | null): string {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CleanCard({ children }: { isCreator: boolean; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {children}
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

/**
 * Stabilize artifact token — polling generates new tokens every 5s but
 * changing it reloads audio/images and interrupts playback. Pin the token
 * from the initial render, then refresh via interval before the 1-hour TTL.
 */
function useStableToken(latestToken: string | undefined): string | null {
  // Lazy initializer captures the first token without an effect
  const [pinned, setPinned] = useState(() => latestToken ?? null);

  useEffect(() => {
    if (!latestToken) return;
    // Refresh the pinned token periodically before server TTL expires
    const id = setInterval(() => {
      setPinned(latestToken);
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [latestToken]);

  return pinned;
}

export function TrackAnalysisCard({ track, progress }: TrackAnalysisCardProps) {
  const isReady = track.processingStatus === "completed";
  const isCreator = track.role === "creator";
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const stableToken = useStableToken(track.artifactToken);
  const tokenParam = stableToken ? `?token=${stableToken}` : "";

  useEffect(() => {
    if (!isReady) return;
    fetch(`/api/artifacts/${track.id}/analysis-meta.json${tokenParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Analysis meta fetch failed: ${r.status}`);
        return r.json();
      })
      .then((meta: AnalysisMeta) => {
        setAnalysisMeta(meta);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load analysis metadata";
        setMetaError(message);
      });
  }, [track.id, isReady, tokenParam]);

  const cutoffHz = analysisMeta?.frequencyCutoff?.hz ?? null;
  const dynamicRange = analysisMeta?.dynamicRange ?? null;

  if (!isReady) {
    const pct = progress?.progress ?? 0;
    const step = progress?.step ?? (track.processingStatus === "failed" ? "" : "Waiting...");

    if (track.processingStatus === "failed") {
      return (
        <CleanCard isCreator={isCreator}>
          <div className="p-5">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                isCreator ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500",
              )}>
                {track.role}
              </span>
              <p className="text-sm font-semibold text-foreground">{track.originalFilename}</p>
            </div>
            <p className="mt-3 text-xs text-destructive">
              Analysis failed: {track.processingError ?? "Unknown error"}
            </p>
          </div>
        </CleanCard>
      );
    }

    return (
      <CleanCard isCreator={isCreator}>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                isCreator ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500",
              )}>
                {track.role}
              </span>
              <p className="text-sm font-semibold text-foreground">{track.originalFilename}</p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[72, 80, 88, 72, 80].map((w, i) => (
              <div key={i} className="h-[26px] animate-pulse rounded-lg bg-muted" style={{ width: w }} />
            ))}
          </div>
          <div className="h-[200px] animate-pulse rounded-lg bg-muted" />
          <div className="mt-3 h-[80px] animate-pulse rounded-lg bg-muted" />
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">{step}</span>
                <span className="text-[11px] font-semibold text-primary">{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isCreator ? "bg-blue-500" : "bg-amber-500",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CleanCard>
    );
  }

  return (
    <CleanCard isCreator={isCreator}>
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isCreator ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500",
            )}>
              {track.role}
            </span>
            <p className="text-sm font-semibold text-foreground">{track.originalFilename}</p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {track.bpm ? <MetaPill label="BPM" value={String(track.bpm)} /> : null}
          <MetaPill label="Codec" value={(track.codec ?? "\u2014").toUpperCase()} />
          <MetaPill label="Bitrate" value={`${track.bitrateKbps ?? "\u2014"} kbps`} />
          <MetaPill
            label="Sample"
            value={`${track.sampleRateHz ? (track.sampleRateHz / 1000).toFixed(1) : "\u2014"} kHz`}
          />
          <MetaPill label="Duration" value={formatDuration(track.durationSeconds)} />
          {dynamicRange && (
            <>
              <MetaPill label="Peak" value={`${dynamicRange.peakDb} dBFS`} />
              <MetaPill label="RMS" value={`${dynamicRange.rmsDb} dBFS`} />
              <MetaPill label="DR" value={`${dynamicRange.crestFactor} dB`} />
            </>
          )}
        </div>
        {metaError ? (
          <div className="rounded-lg border border-border bg-muted px-4 py-3">
            <p className="text-xs text-destructive">Failed to load analysis: {metaError}</p>
          </div>
        ) : (
          <>
            <SpectrogramSection
              trackId={track.id}
              duration={track.durationSeconds ?? 0}
              cutoffHz={cutoffHz}
              nyquistHz={track.sampleRateHz ? track.sampleRateHz / 2 : 22050}
              tokenParam={tokenParam}
            />
            <WaveformPlayer
              trackId={track.id}
              duration={track.durationSeconds ?? 0}
              tokenParam={tokenParam}
              analysisMeta={analysisMeta}
            />
          </>
        )}
      </div>
    </CleanCard>
  );
}
