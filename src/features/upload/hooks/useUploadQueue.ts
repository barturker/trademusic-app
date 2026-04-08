"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import * as tus from "tus-js-client";

import { publicEnv } from "@/lib/env";
import { getUploadToken } from "../actions";
import { TUS_CHUNK_SIZE, MAX_FILE_SIZE_BYTES, AUDIO_EXTENSIONS } from "../constants";

import type { QueueItem } from "../types";

interface UseUploadQueueOptions {
  roomId: string;
  participantSecret: string;
  maxSlots: number;
  currentTrackCount: number;
  onFileComplete?: () => void;
  onError?: (filename: string, error: string) => void;
}

let nextId = 0;
function generateItemId(): string {
  nextId += 1;
  return `upload-${nextId}-${Date.now()}`;
}

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function useUploadQueue({
  roomId,
  participantSecret,
  maxSlots,
  currentTrackCount,
  onFileComplete,
  onError,
}: UseUploadQueueOptions) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const isUploadingRef = useRef(false);
  const tusRef = useRef<tus.Upload | null>(null);
  const abortedRef = useRef(false);

  const remainingSlots = maxSlots - currentTrackCount - queue.filter((q) => q.status === "queued" || q.status === "uploading").length;

  /** Add files to the queue. Validates size/type, skips files over slot limit. */
  const addFiles = useCallback(
    (files: File[]) => {
      const available = maxSlots - currentTrackCount - queue.filter((q) => q.status === "queued" || q.status === "uploading").length;
      if (available <= 0) return;

      const accepted = files.slice(0, available);
      const newItems: QueueItem[] = [];

      for (const file of accepted) {
        const ext = getExtension(file.name);
        if (!AUDIO_EXTENSIONS.includes(ext as (typeof AUDIO_EXTENSIONS)[number])) {
          onError?.(file.name, `Unsupported format: ${ext || "no extension"}`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          onError?.(file.name, "File too large (max 150MB)");
          continue;
        }
        newItems.push({
          id: generateItemId(),
          file,
          status: "queued",
          progress: { bytesUploaded: 0, bytesTotal: file.size, percentage: 0 },
          error: null,
        });
      }

      if (newItems.length > 0) {
        setQueue((prev) => [...prev, ...newItems]);
      }
    },
    [maxSlots, currentTrackCount, queue, onError],
  );

  /** Remove a queued (not uploading) item from the queue. */
  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id || item.status === "uploading"));
  }, []);

  /** Clear completed and errored items from the queue. */
  const clearDone = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status === "queued" || item.status === "uploading"));
  }, []);

  /** Abort the current upload and clear the queue. */
  const abortAll = useCallback(() => {
    abortedRef.current = true;
    if (tusRef.current) {
      tusRef.current.abort();
      tusRef.current = null;
    }
    isUploadingRef.current = false;
    setQueue([]);
  }, []);

  /** Process next queued file. */
  useEffect(() => {
    if (isUploadingRef.current || abortedRef.current) return;

    const found = queue.find((item) => item.status === "queued");
    if (!found) return;

    // Capture values before async work
    const itemId = found.id;
    const itemFile = found.file;

    isUploadingRef.current = true;
    abortedRef.current = false;

    async function uploadFile() {
      // Mark as uploading inside async to avoid synchronous setState in effect
      setQueue((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: "uploading" as const } : item)),
      );
      const tokenResult = await getUploadToken(roomId, participantSecret);
      if (!tokenResult.success) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: "error" as const, error: tokenResult.error } : item,
          ),
        );
        isUploadingRef.current = false;
        onError?.(itemFile.name, tokenResult.error);
        return;
      }

      const { uploadToken } = tokenResult.data;
      let lastPct = -1;

      const upload = new tus.Upload(itemFile, {
        endpoint: publicEnv.UPLOAD_URL,
        chunkSize: TUS_CHUNK_SIZE,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          roomId,
          uploadToken,
          filename: itemFile.name,
          filetype: itemFile.type,
        },
        onProgress(bytesUploaded, bytesTotal) {
          const pct = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
          if (pct === lastPct) return;
          lastPct = pct;
          setQueue((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, progress: { bytesUploaded, bytesTotal, percentage: pct } }
                : item,
            ),
          );
        },
        onSuccess() {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    status: "complete" as const,
                    progress: {
                      bytesUploaded: itemFile.size,
                      bytesTotal: itemFile.size,
                      percentage: 100,
                    },
                  }
                : item,
            ),
          );
          tusRef.current = null;
          isUploadingRef.current = false;
          onFileComplete?.();
        },
        onError(err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          setQueue((prev) =>
            prev.map((item) =>
              item.id === itemId ? { ...item, status: "error" as const, error: message } : item,
            ),
          );
          tusRef.current = null;
          isUploadingRef.current = false;
          onError?.(itemFile.name, message);
        },
      });

      tusRef.current = upload;
      upload.start();
    }

    uploadFile();
  }, [queue, roomId, participantSecret, onFileComplete, onError]);

  const isActive = queue.some((item) => item.status === "uploading" || item.status === "queued");

  return { queue, isActive, remainingSlots, addFiles, removeItem, clearDone, abortAll };
}
