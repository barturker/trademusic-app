"use client";

import { AlertCircle, CheckCircle, Clock, Loader2, Music, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Track } from "@/types/room";
import type { QueueItem } from "@/lib/upload-constants";

const MAX_SLOTS = 5;

interface SideColumnProps {
  label: string;
  color: string;
  bgColor: string;
  tracks: Track[];
  approved?: boolean;
  isOwn: boolean;
  queue: QueueItem[];
  onDropClick: () => void;
  onRemoveItem: (id: string) => void;
  onAbortAll: () => void;
}

export function SideColumn({
  label,
  color,
  bgColor,
  tracks,
  approved,
  isOwn,
  queue,
  onDropClick,
  onRemoveItem,
  onAbortAll,
}: SideColumnProps) {
  const activeQueue = queue.filter((q) => q.status !== "complete");
  const remaining = MAX_SLOTS - tracks.length - activeQueue.length;
  const isFull = remaining <= 0 && activeQueue.length === 0;
  const isUploading = queue.some((q) => q.status === "uploading");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium uppercase tracking-wide ${color}`}>
          {label} ({tracks.length}/{MAX_SLOTS})
        </p>
        {approved !== undefined && (
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full ${
                approved ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            />
            <span
              className={`text-xs ${
                approved ? "font-medium text-emerald-500" : "text-muted-foreground"
              }`}
            >
              {approved ? "Approved" : "Pending"}
            </span>
          </div>
        )}
      </div>

      {/* Track list */}
      {tracks.length > 0 && (
        <div className="space-y-1.5">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 bg-muted/40 transition-colors hover:bg-muted/70 text-left"
              onClick={() => {
                document
                  .getElementById(`track-${track.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
                <Music className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <span className="min-w-0 truncate text-sm font-medium">
                {track.originalFilename}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Upload queue */}
      {isOwn && activeQueue.length > 0 && (
        <div className="space-y-1.5">
          {activeQueue.map((item) => (
            <QueueItemRow key={item.id} item={item} onRemove={onRemoveItem} />
          ))}
          {isUploading && (
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
              onClick={onAbortAll}
              aria-label="Cancel all uploads"
            >
              Cancel all
            </button>
          )}
        </div>
      )}

      {/* Drop zone — visible when slots available, even during upload */}
      {isOwn && remaining > 0 && (
        <button
          type="button"
          className={cn(
            "flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors",
            "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
          )}
          onClick={onDropClick}
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {tracks.length === 0 && activeQueue.length === 0
              ? "Drop or click to add tracks"
              : `${remaining} more`}
          </span>
        </button>
      )}

      {/* Full indicator */}
      {isOwn && isFull && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 py-2">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-500">All slots filled</span>
        </div>
      )}

      {/* Other side — empty state */}
      {!isOwn && tracks.length === 0 && (
        <div className="flex min-h-[42px] flex-1 items-center justify-center rounded-lg border border-dashed border-border/50">
          <span className="text-xs text-muted-foreground/50">No tracks yet</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QueueItemRow({ item, onRemove }: { item: QueueItem; onRemove: (id: string) => void }) {
  const isUploading = item.status === "uploading";
  const isError = item.status === "error";
  const isQueued = item.status === "queued";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2",
        isUploading && "border border-dashed border-primary/40 bg-primary/5",
        isQueued && "bg-muted/30",
        isError && "border border-dashed border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        {isQueued && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
        {isError && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.file.name}</p>
        {isUploading && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${item.progress.percentage}%` }}
            />
          </div>
        )}
        {isError && item.error && (
          <p className="truncate text-xs text-destructive">{item.error}</p>
        )}
      </div>

      {isUploading && (
        <span className="shrink-0 text-xs font-semibold text-primary">
          {item.progress.percentage}%
        </span>
      )}

      {(isQueued || isError) && (
        <button
          type="button"
          className="shrink-0 rounded p-0.5 hover:bg-muted"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.file.name} from queue`}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
