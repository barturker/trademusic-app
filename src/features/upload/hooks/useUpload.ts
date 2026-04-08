"use client";

import { useCallback, useRef, useState } from "react";

import * as tus from "tus-js-client";

import { publicEnv } from "@/lib/env";
import { getUploadToken } from "../actions";
import { TUS_CHUNK_SIZE } from "../constants";

import type { UploadState } from "../types";

const INITIAL_STATE: UploadState = {
  status: "idle",
  progress: { bytesUploaded: 0, bytesTotal: 0, percentage: 0 },
  error: null,
  uploadUrl: null,
};

interface UseUploadOptions {
  roomId: string;
  participantSecret: string;
  onComplete?: (uploadUrl: string) => void;
  onError?: (error: string) => void;
}

export function useUpload({ roomId, participantSecret, onComplete, onError }: UseUploadOptions) {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const uploadRef = useRef<tus.Upload | null>(null);
  const lastPctRef = useRef(-1);

  const start = useCallback(
    async (file: File) => {
      lastPctRef.current = -1;

      setState({
        status: "uploading",
        progress: { bytesUploaded: 0, bytesTotal: file.size, percentage: 0 },
        error: null,
        uploadUrl: null,
      });

      // Exchange participant secret for a short-lived upload token (Issue 7)
      const tokenResult = await getUploadToken(roomId, participantSecret);
      if (!tokenResult.success) {
        const message = tokenResult.error;
        setState((prev) => ({ ...prev, status: "error", error: message }));
        onError?.(message);
        return;
      }

      const { uploadToken } = tokenResult.data;
      const totalSize = file.size;

      const updateProgress = (bytesUploaded: number, bytesTotal: number) => {
        const pct = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
        // Skip if percentage hasn't visually changed
        if (pct === lastPctRef.current) return;
        lastPctRef.current = pct;
        setState((prev) => ({
          ...prev,
          progress: { bytesUploaded, bytesTotal, percentage: pct },
        }));
      };

      const upload = new tus.Upload(file, {
        endpoint: publicEnv.UPLOAD_URL,
        chunkSize: TUS_CHUNK_SIZE,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          roomId,
          uploadToken,
          filename: file.name,
          filetype: file.type,
        },
        onChunkComplete(_chunkSize, bytesAccepted, bytesTotal) {
          updateProgress(bytesAccepted, bytesTotal);
        },
        onProgress(bytesUploaded, bytesTotal) {
          updateProgress(bytesUploaded, bytesTotal);
        },
        onSuccess() {
          const url = upload.url ?? "";
          setState({
            status: "complete",
            progress: { bytesUploaded: totalSize, bytesTotal: totalSize, percentage: 100 },
            error: null,
            uploadUrl: url,
          });
          onComplete?.(url);
        },
        onError(err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          setState((prev) => ({
            ...prev,
            status: "error",
            error: message,
          }));
          onError?.(message);
        },
      });

      uploadRef.current = upload;
      upload.start();
    },
    [roomId, participantSecret, onComplete, onError],
  );

  const abort = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      setState(INITIAL_STATE);
    }
  }, []);

  const reset = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
    }
    setState(INITIAL_STATE);
  }, []);

  return { state, start, abort, reset };
}
