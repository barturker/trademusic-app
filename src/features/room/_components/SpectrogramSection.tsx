"use client";

import Image from "next/image";

const SPECTROGRAM_HEIGHT = 200;
const SPECTROGRAM_WIDTH = 800;
const TIME_LABEL_STEPS = 10;

interface SpectrogramSectionProps {
  trackId: string;
  duration: number;
  cutoffHz: number | null;
  nyquistHz: number;
  tokenParam: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SpectrogramSection({
  trackId,
  duration,
  cutoffHz,
  nyquistHz,
  tokenParam,
}: SpectrogramSectionProps) {
  const timeLabels: string[] = [];
  for (let i = 0; i <= TIME_LABEL_STEPS; i++) {
    timeLabels.push(formatTime((duration / TIME_LABEL_STEPS) * i));
  }

  return (
    <div className="grid grid-cols-[40px_1fr_70px] grid-rows-[1fr_24px]">
      <div className="flex flex-col justify-between pr-2 text-right font-mono text-[10px] text-muted-foreground">
        <span>22k</span><span>16k</span><span>10k</span><span>4k</span><span>0</span>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border">
        <Image
          src={`/api/artifacts/${trackId}/spectrogram.png${tokenParam}`}
          alt="Spectrogram frequency analysis"
          width={SPECTROGRAM_WIDTH}
          height={SPECTROGRAM_HEIGHT}
          unoptimized
          className="block h-[200px] w-full object-fill"
        />
        {cutoffHz !== null && (
          <div
            className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-white/70"
            style={{ top: `${((nyquistHz - cutoffHz) / nyquistHz) * 100}%` }}
          >
            <span className="absolute right-1 top-0.5 rounded-sm bg-black/60 px-1 py-px font-mono text-[8px] text-white/90">
              {(cutoffHz / 1000).toFixed(1)}kHz
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-1.5 pl-2.5">
        <div
          className="w-3 rounded-sm border border-border"
          style={{ background: "linear-gradient(to bottom, #fff, #ff0, #f80, #f00, #c06, #60c, #006, #002)" }}
        />
        <div className="flex flex-col justify-between font-mono text-[10px] text-muted-foreground">
          <span>0 dB</span><span>-40</span><span>-80</span>
        </div>
      </div>
      <div className="col-start-2 flex justify-between pt-1 font-mono text-[10px] text-muted-foreground">
        {timeLabels.filter((_, i) => i % 2 === 0).map((t) => <span key={t}>{t}</span>)}
      </div>
    </div>
  );
}
