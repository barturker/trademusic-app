"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import type { AnalysisMeta } from "./TrackAnalysisCard";

const COL_OUTSIDE = "#C8CAD0";
const COL_SNIPPET_UNPLAYED = "#93B4FF";
const COL_SNIPPET_PLAYED = "#3767EA";
const COL_BOUNDARY = "#3767EA";
const CANVAS_HEIGHT = 160;
const AMPLITUDE_SCALE = 0.9;

interface WaveformPlayerProps {
  trackId: string;
  duration: number;
  tokenParam: string;
  analysisMeta: AnalysisMeta | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WaveformPlayer({ trackId, duration, tokenParam, analysisMeta }: WaveformPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peaksRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [snippetLabel, setSnippetLabel] = useState("");
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformError, setWaveformError] = useState<string | null>(null);

  const initCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth * dpr;
    const h = CANVAS_HEIGHT;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvasSizeRef.current = { w, h };
  }, []);

  const drawWaveform = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      if (!canvas || peaksRef.current.length === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { w, h } = canvasSizeRef.current;
      if (w === 0) return;

      const peaks = peaksRef.current;
      const totalDur = analysisMeta?.duration ?? duration;
      const snipStart = analysisMeta?.snippet.start ?? 0;
      const snipLen = analysisMeta?.snippet.duration ?? 30;
      const barW = w / peaks.length;
      const mid = h / 2;
      const snippetStartX = (snipStart / totalDur) * w;
      const snippetEndX = ((snipStart + snipLen) / totalDur) * w;
      const playheadX = snippetStartX + progress * (snippetEndX - snippetStartX);

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < peaks.length; i++) {
        const x = i * barW;
        const barH = peaks[i] * mid * AMPLITUDE_SCALE;
        const inSnippet = x >= snippetStartX && x <= snippetEndX;
        if (!inSnippet) ctx.fillStyle = COL_OUTSIDE;
        else if (x <= playheadX) ctx.fillStyle = COL_SNIPPET_PLAYED;
        else ctx.fillStyle = COL_SNIPPET_UNPLAYED;
        ctx.fillRect(x, mid - barH, Math.max(barW - 0.5, 1), barH * 2);
      }
      ctx.strokeStyle = COL_BOUNDARY;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = 0.6;
      for (const bx of [snippetStartX, snippetEndX]) {
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    },
    [duration, analysisMeta],
  );

  useEffect(() => {
    fetch(`/api/artifacts/${trackId}/waveform.json${tokenParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Waveform fetch failed: ${r.status}`);
        return r.json();
      })
      .then((waveform: { peaks: number[] }) => {
        peaksRef.current = waveform.peaks;
        if (analysisMeta) {
          setSnippetLabel(
            `Snippet ${formatTime(analysisMeta.snippet.start)} \u2013 ${formatTime(analysisMeta.snippet.start + analysisMeta.snippet.duration)}`,
          );
        }
        initCanvasSize();
        drawWaveform(0);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load waveform";
        setWaveformError(message);
      });
  }, [trackId, duration, drawWaveform, initCanvasSize, tokenParam, analysisMeta]);

  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const audio = audioRef.current;
      if (audio && audio.duration > 0) {
        setCurrentTime(audio.currentTime);
        drawWaveform(audio.currentTime / audio.duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, drawWaveform]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((err: unknown) => {
        // NotAllowedError is expected when autoplay policy blocks playback
        if (err instanceof DOMException && err.name === "NotAllowedError") return;
        const message = err instanceof Error ? err.message : "Playback failed";
        setWaveformError(message);
      });
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    setCurrentTime(0);
    drawWaveform(0);
  }

  function seekAndPlay(audio: HTMLAudioElement, time: number) {
    audio.currentTime = time;
    setCurrentTime(time);
    drawWaveform(time / audioDuration);
    if (audio.paused) {
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "NotAllowedError") return;
        const message = err instanceof Error ? err.message : "Playback failed";
        setWaveformError(message);
      });
      setIsPlaying(true);
    }
  }

  function handleWaveformClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !analysisMeta || !audioDuration) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const totalDur = analysisMeta.duration ?? duration;
    const snipStart = analysisMeta.snippet.start;
    const snipEnd = snipStart + analysisMeta.snippet.duration;
    const clickTime = clickX * totalDur;

    if (clickTime < snipStart || clickTime > snipEnd) return;

    const seekRatio = (clickTime - snipStart) / (snipEnd - snipStart);
    seekAndPlay(audio, seekRatio * audioDuration);
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekAndPlay(audio, ratio * audioDuration);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !isMuted;
    setIsMuted(next);
    audio.muted = next;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const v = parseFloat(e.target.value);
    setVolume(v);
    audio.volume = v;
    if (v === 0) setIsMuted(true);
    else setIsMuted(false);
  }

  const playProgress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
  const displayDuration = audioDuration > 0 ? audioDuration : 30;

  if (waveformError) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted px-4 py-3">
        <p className="text-xs text-destructive">Failed to load waveform: {waveformError}</p>
      </div>
    );
  }

  return (
    <>
      {/* Waveform */}
      <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-muted">
        <canvas ref={canvasRef} onClick={handleWaveformClick} className="block h-[80px] w-full cursor-pointer" height={80} />
        <span className="absolute top-1.5 left-2 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Waveform
        </span>
        {snippetLabel && (
          <span className="absolute top-1.5 right-2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
            {snippetLabel}
          </span>
        )}
      </div>
      {/* Player controls */}
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-opacity hover:opacity-80"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex min-w-[100px] flex-col gap-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">128kbps Preview</span>
          <span className="font-mono text-xs text-foreground">
            {formatTime(currentTime)} / {formatTime(displayDuration)}
          </span>
        </div>
        <div
          className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label="Audio playback progress"
          aria-valuenow={Math.round(playProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          onClick={handleProgressClick}
        >
          <div className="pointer-events-none h-full rounded-full bg-primary" style={{ width: `${playProgress}%` }} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={toggleMute}
            aria-label={isMuted || volume === 0 ? "Unmute audio" : "Mute audio"}
            className="text-muted-foreground transition-opacity hover:opacity-70"
          >
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range" min="0" max="1" step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume control"
            className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-border accent-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={`/api/artifacts/${trackId}/snippet.mp3${tokenParam}`}
        preload="auto"
        onEnded={handleEnded}
        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
        onContextMenu={(e) => e.preventDefault()}
        className="hidden"
      />
    </>
  );
}
