import { Clock } from "lucide-react";

import type { RoomStatus } from "@/types/room";

interface WaitingStateProps {
  status: RoomStatus;
}

const STATUS_MESSAGES: Partial<Record<RoomStatus, string>> = {
  created: "Waiting for your trading partner to join...",
};

const DEFAULT_MESSAGE = "Waiting for both participants to upload their tracks.";

export function WaitingState({ status }: WaitingStateProps) {
  const message = STATUS_MESSAGES[status] ?? DEFAULT_MESSAGE;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-[0_0_12px_rgba(0,0,0,0.1)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Clock className="h-4 w-4 animate-pulse text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          This page refreshes automatically.
        </p>
      </div>
    </div>
  );
}
