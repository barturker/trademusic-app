import { Badge } from "@/components/ui/badge";

import type { StatusBreakdown as StatusBreakdownType } from "../types";
import type { RoomStatus } from "@/types/room";

interface StatusBreakdownProps {
  breakdown: StatusBreakdownType;
}

const STATUS_LABELS: Record<RoomStatus, string> = {
  created: "Created",
  waiting_for_peer: "Waiting",
  processing: "Processing",
  ready_for_review: "Review",
  a_approved: "A Approved",
  b_approved: "B Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
  expired: "Expired",
};

const STATUS_VARIANTS: Record<RoomStatus, "default" | "secondary" | "destructive" | "outline"> = {
  created: "outline",
  waiting_for_peer: "secondary",
  processing: "default",
  ready_for_review: "secondary",
  a_approved: "secondary",
  b_approved: "secondary",
  completed: "default",
  cancelled: "destructive",
  disputed: "destructive",
  expired: "outline",
};

export function StatusBreakdown({ breakdown }: StatusBreakdownProps) {
  const entries = Object.entries(breakdown) as [RoomStatus, number][];
  const nonZero = entries.filter(([, count]) => count > 0);

  if (nonZero.length === 0) {
    return <p className="text-sm text-muted-foreground">No rooms yet</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nonZero.map(([status, count]) => (
        <Badge key={status} variant={STATUS_VARIANTS[status]}>
          {STATUS_LABELS[status]}: {count}
        </Badge>
      ))}
    </div>
  );
}
