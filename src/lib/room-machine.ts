import type { RoomStatus } from "@/types/room";

/**
 * Room state machine — pure TypeScript, no side effects.
 *
 * State flow:
 *   created → waiting_for_peer → processing → ready_for_review
 *     → a_approved / b_approved → completed
 *     → cancelled (from most states)
 *     → expired (from any non-terminal state, after expiresAt)
 *     → disputed (from ready_for_review, if flagged)
 */

const VALID_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  created: ["waiting_for_peer", "cancelled", "expired"],
  waiting_for_peer: ["processing", "cancelled", "expired"],
  processing: ["ready_for_review", "cancelled", "expired"],
  ready_for_review: ["a_approved", "b_approved", "cancelled", "disputed", "expired"],
  a_approved: ["completed", "cancelled", "expired"],
  b_approved: ["completed", "cancelled", "expired"],
  completed: ["expired"],
  cancelled: [],
  disputed: ["cancelled", "expired"],
  expired: [],
};

/** Check if transitioning from `from` to `to` is allowed. */
export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/** Attempt a state transition. Returns new status or null if invalid. */
export function transition(from: RoomStatus, to: RoomStatus): RoomStatus | null {
  if (!canTransition(from, to)) return null;
  return to;
}

/** Get all valid next states from the current status. */
export function getNextStates(status: RoomStatus): readonly RoomStatus[] {
  return VALID_TRANSITIONS[status];
}

/** Check if the room is in a terminal state (no further transitions). */
export function isTerminal(status: RoomStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/** Check if cancellation is allowed from the current status. */
export function canCancel(status: RoomStatus): boolean {
  return VALID_TRANSITIONS[status].includes("cancelled");
}
