"use client";

import { useCallback, useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";

import { publicEnv } from "@/lib/env";
import { roomKeys } from "./keys";

interface AnalysisProgress {
  trackId: string;
  step: string;
  progress: number;
}

/**
 * Connect to Socket.io server for realtime room updates.
 *
 * On `room-updated` → invalidates React Query cache → triggers refetch.
 * On `analysis-progress` → updates local progress state.
 * Also tracks participant presence (who's online).
 */
export function useRoomSocket(roomId: string, secret: string) {
  const queryClient = useQueryClient();
  const [presence, setPresence] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<Map<string, AnalysisProgress>>(
    new Map(),
  );

  const getTrackProgress = useCallback(
    (trackId: string): AnalysisProgress | undefined => {
      return analysisProgress.get(trackId);
    },
    [analysisProgress],
  );

  useEffect(() => {
    if (!roomId || !secret) return;

    const socket = io(publicEnv.SOCKET_URL, {
      auth: { roomId, secret },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Stop reconnecting on auth errors to avoid IP ban from repeated failures
    socket.on("connect_error", (err) => {
      const fatal = /invalid credentials|room not found|missing roomid/i.test(err.message);
      if (fatal) {
        socket.disconnect();
      }
    });

    socket.on("room-updated", () => {
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
    });

    socket.on("analysis-progress", (data: AnalysisProgress) => {
      setAnalysisProgress((prev) => {
        const next = new Map(prev);
        next.set(data.trackId, data);
        return next;
      });

      // When analysis completes, invalidate to refetch full data
      if (data.progress >= 95) {
        queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
      }
    });

    socket.on("presence", (roles: string[]) => {
      setPresence(roles);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("room-updated");
      socket.off("analysis-progress");
      socket.off("presence");
      socket.disconnect();
    };
  }, [roomId, secret, queryClient]);

  return { presence, isConnected, getTrackProgress };
}
