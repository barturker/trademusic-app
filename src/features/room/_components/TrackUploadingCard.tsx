import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface TrackUploadingCardProps {
  filename: string;
  percentage: number;
  isCreator: boolean;
}

export function TrackUploadingCard({ filename, percentage, isCreator }: TrackUploadingCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-5">
        {/* Header — real filename */}
        <div className="mb-4 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                isCreator ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500",
              )}
            >
              {isCreator ? "creator" : "joiner"}
            </span>
            <p className="text-sm font-semibold text-foreground">{filename}</p>
          </div>
        </div>
        {/* Skeleton metadata pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[72, 80, 88, 72, 80].map((w, i) => (
            <div key={i} className="h-[26px] animate-pulse rounded-lg bg-muted" style={{ width: w }} />
          ))}
        </div>
        {/* Skeleton spectrogram */}
        <div className="h-[200px] animate-pulse rounded-lg bg-muted" />
        {/* Skeleton waveform */}
        <div className="mt-3 h-[80px] animate-pulse rounded-lg bg-muted" />
        {/* Upload progress */}
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Uploading...</span>
              <span className="text-[11px] font-semibold text-primary">{percentage}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-200",
                  isCreator ? "bg-blue-500" : "bg-amber-500",
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
