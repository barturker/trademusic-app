"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import type { DragEvent, ReactNode } from "react";

import { toast } from "sonner";

import { saveInviteCode, saveSecret } from "@/lib/identity";
import { AUDIO_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/upload-constants";
import { createRoom } from "@/features/room/actions";
import { usePendingUploadStore } from "@/stores/pendingUpload";

function isAudioFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext !== undefined && (AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

interface HomeDropZoneProps {
  children: ReactNode;
}

export function HomeDropZone({ children }: HomeDropZoneProps) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const setFiles = usePendingUploadStore((s) => s.setFiles);

  // Track nested drag enters/leaves to avoid flicker
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setDragging(true);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setDragging(false);
      }
    },
    [],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      dragCounterRef.current = 0;

      if (pending) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      // Validate: audio files only
      const audioFiles = droppedFiles.filter(isAudioFile);
      if (audioFiles.length === 0) {
        toast.error("Only audio files are supported.");
        return;
      }

      // Validate: file size
      const oversized = audioFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
      if (oversized.length > 0) {
        toast.error(`Max file size is 150 MB. ${oversized.length} file(s) too large.`);
        return;
      }

      // Non-audio files were silently filtered — notify if some were skipped
      const skipped = droppedFiles.length - audioFiles.length;
      if (skipped > 0) {
        toast.info(`${skipped} non-audio file(s) skipped.`);
      }

      startTransition(async () => {
        const result = await createRoom();
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        saveSecret("creator", result.data.roomId, result.data.creatorSecret);
        saveInviteCode(result.data.roomId, result.data.inviteCode);
        setFiles(audioFiles);
        toast.success("Room created! Uploading your tracks...");
        router.push(`/room/${result.data.roomId}`);
      });
    },
    [pending, setFiles, router, startTransition],
  );

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {(dragging || pending) && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/40 px-16 py-12">
            <svg
              className="h-12 w-12 text-white/80"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-lg font-semibold text-white">
              {pending ? "Creating room..." : "Drop audio files to start a trade"}
            </p>
            <p className="text-sm text-white/60">
              WAV, FLAC, MP3, AIFF, M4A, OGG — up to 150 MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
