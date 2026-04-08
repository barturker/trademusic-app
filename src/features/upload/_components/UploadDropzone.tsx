"use client";

import { useCallback, useEffect, useRef } from "react";

import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUpload } from "../hooks/useUpload";
import { ACCEPT_STRING, MAX_FILE_SIZE_BYTES } from "../constants";

import type { UploadStatus } from "../types";

interface UploadDropzoneProps {
  roomId: string;
  participantSecret: string;
  currentTrackCount: number;
  maxTracks: number;
  onComplete?: (uploadUrl: string) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const STATUS_CONFIG: Record<UploadStatus, { icon: typeof Upload; label: string; color: string }> = {
  idle: {
    icon: Upload,
    label: "Drop audio file or click to browse",
    color: "text-muted-foreground",
  },
  uploading: { icon: Loader2, label: "Uploading", color: "text-primary" },
  encrypting: { icon: Loader2, label: "Encrypting...", color: "text-primary" },
  complete: { icon: CheckCircle, label: "Upload complete", color: "text-green-500" },
  error: { icon: AlertCircle, label: "Upload failed", color: "text-destructive" },
};

export function UploadDropzone({
  roomId,
  participantSecret,
  currentTrackCount,
  maxTracks,
  onComplete,
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, start, abort, reset } = useUpload({
    roomId,
    participantSecret,
    onComplete,
    onError: (error) => toast.error(error),
  });

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error("File too large (max 150MB)");
        return;
      }
      start(file);
    },
    [start],
  );

  useEffect(() => {
    if (state.status === "complete") {
      const timer = setTimeout(() => reset(), 1500);
      return () => clearTimeout(timer);
    }
  }, [state.status, reset]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const isActive = state.status === "uploading" || state.status === "encrypting";
  const isDone = state.status === "complete";
  const config = STATUS_CONFIG[state.status];
  const Icon = config.icon;

  const isAtLimit = currentTrackCount >= maxTracks;

  if (isAtLimit) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-green-500/30 bg-card p-8",
          className,
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
          <CheckCircle className="h-7 w-7 text-green-500" />
        </div>
        <p className="text-sm font-semibold text-green-500">
          {currentTrackCount}/{maxTracks} tracks uploaded
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-card p-10 transition-colors",
        state.status === "idle" && "cursor-pointer border-border hover:border-primary/40 hover:bg-[#E0EAFF]/30",
        isActive && "border-primary/30 bg-[#E0EAFF]/30",
        isDone && "border-green-500/30 bg-card",
        state.status === "error" && "border-destructive/30 bg-card",
        className,
      )}
      onDrop={state.status === "idle" ? handleDrop : undefined}
      onDragOver={state.status === "idle" ? (e) => e.preventDefault() : undefined}
      onClick={state.status === "idle" ? () => inputRef.current?.click() : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleChange}
        className="hidden"
      />

      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl",
        state.status === "idle" && "bg-[#E0EAFF]",
        isActive && "bg-[#E0EAFF]",
        isDone && "bg-green-500/10",
        state.status === "error" && "bg-destructive/10",
      )}>
        <Icon className={cn("h-7 w-7", config.color, isActive && "animate-spin")} />
      </div>

      <div className="text-center">
        <p className={cn("text-sm font-semibold", config.color)}>
          {state.status === "uploading" ? `Uploading ${state.progress.percentage}%` : config.label}
        </p>
        {state.status === "idle" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {currentTrackCount}/{maxTracks} tracks — WAV, AIFF, FLAC, MP3, AAC, OGG, OPUS — max 150MB
          </p>
        )}
      </div>

      {isActive && (
        <div className="w-full max-w-xs space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${state.progress.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(state.progress.bytesUploaded)} / {formatBytes(state.progress.bytesTotal)}
            </span>
            <span className="font-semibold text-primary">{state.progress.percentage}%</span>
          </div>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground" onClick={abort}>
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      )}

      {state.status === "error" && state.error && (
        <div className="space-y-2 text-center">
          <p className="text-xs text-destructive">{state.error}</p>
          <Button variant="ghost" size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
