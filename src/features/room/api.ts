import { mapErrorKind } from "@/lib/errors";

import type { ApiResult } from "@/types/api";
import type { RoomDetail } from "@/types/room";

export async function fetchRoom(
  roomId: string,
  secret: string,
  signal?: AbortSignal,
): Promise<ApiResult<RoomDetail>> {
  try {
    const res = await fetch(`/api/rooms/${roomId}`, {
      headers: { "X-Participant-Secret": secret },
      signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return {
        success: false,
        error: (body as { error?: string }).error ?? res.statusText,
        kind: mapErrorKind(res),
      };
    }

    const data: RoomDetail = await res.json();
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
      kind: mapErrorKind(e),
    };
  }
}
