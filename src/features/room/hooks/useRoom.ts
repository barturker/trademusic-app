import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/errors";
import { isTerminal } from "@/lib/room-machine";
import { fetchRoom } from "../api";
import { roomKeys } from "./keys";

import type { RoomDetail } from "@/types/room";
import type { ErrorKind } from "@/types/api";

/** Fallback polling interval when socket is disconnected. */
const FALLBACK_POLL_MS = 15_000;

/** Error kinds that should stop polling — retrying won't help. */
const TERMINAL_ERROR_KINDS: ErrorKind[] = ["auth", "forbidden", "gone", "not_found"];

interface UseRoomOptions {
  initialData?: RoomDetail;
  isSocketConnected?: boolean;
}

export function useRoom(roomId: string, secret: string, options: UseRoomOptions = {}) {
  const { initialData, isSocketConnected = false } = options;

  return useQuery({
    queryKey: roomKeys.detail(roomId),
    queryFn: async ({ signal }) => {
      const result = await fetchRoom(roomId, secret, signal);
      if (!result.success) throw new ApiError(result.error, result.kind);
      return result.data;
    },
    enabled: Boolean(roomId && secret),
    initialData,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && TERMINAL_ERROR_KINDS.includes(error.kind)) return false;
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      const { data, error } = query.state;
      if (error instanceof ApiError && TERMINAL_ERROR_KINDS.includes(error.kind)) return false;
      if (data && isTerminal(data.status)) return false;
      if (isSocketConnected) return false;
      return FALLBACK_POLL_MS;
    },
  });
}
