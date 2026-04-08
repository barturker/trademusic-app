import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { RoomStatus } from "@/types/room";

const STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; className: string }
> = {
  created: {
    label: "Created",
    className: "bg-blue-500/15 text-blue-500",
  },
  waiting_for_peer: {
    label: "Waiting",
    className: "bg-yellow-500/15 text-yellow-500",
  },
  processing: {
    label: "Processing",
    className: "bg-purple-500/15 text-purple-500",
  },
  ready_for_review: {
    label: "Review",
    className: "bg-cyan-500/15 text-track-accent",
  },
  a_approved: {
    label: "Partially Approved",
    className: "bg-emerald-500/15 text-emerald-500",
  },
  b_approved: {
    label: "Partially Approved",
    className: "bg-emerald-500/15 text-emerald-500",
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/15 text-green-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-500/15 text-red-500",
  },
  disputed: {
    label: "Disputed",
    className: "bg-orange-500/15 text-orange-500",
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
  },
};

interface RoomStatusBadgeProps {
  status: RoomStatus;
}

export function RoomStatusBadge({ status }: RoomStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      className={cn(
        "border-none px-3 py-1 text-xs font-bold tracking-wide",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}
