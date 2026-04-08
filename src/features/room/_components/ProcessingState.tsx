import { Loader2 } from "lucide-react";

export function ProcessingState() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-[0_0_12px_rgba(0,0,0,0.1)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Analyzing tracks...</p>
        <p className="text-xs text-muted-foreground">
          Extracting BPM, waveforms, and generating previews.
        </p>
      </div>
    </div>
  );
}
