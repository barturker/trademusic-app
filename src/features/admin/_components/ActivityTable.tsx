import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";

import type { AdminRoomSummary } from "../types";
import type { RoomStatus } from "@/types/room";

interface ActivityTableProps {
  rooms: AdminRoomSummary[];
}

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

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortId(id: string): string {
  return id.slice(0, 8);
}

export function ActivityTable({ rooms }: ActivityTableProps) {
  if (rooms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No room activity yet
      </p>
    );
  }

  const adminPath = env.ADMIN_PATH;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium text-muted-foreground">
            <th className="pb-2 pr-4">Room</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2 pr-4">Created</th>
            <th className="pb-2 pr-4">Joined</th>
            <th className="pb-2 pr-4 text-right">Tracks</th>
            <th className="pb-2 text-right">Downloads</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-b border-border/50 last:border-0">
              <td className="py-2.5 pr-4">
                <Link
                  href={`/${adminPath}/room/${room.id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {formatShortId(room.id)}
                </Link>
              </td>
              <td className="py-2.5 pr-4">
                <Badge variant={STATUS_VARIANTS[room.status]}>
                  {room.status.replace(/_/g, " ")}
                </Badge>
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground">
                {formatDate(room.createdAt)}
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground">
                {room.joinedAt ? formatDate(room.joinedAt) : "—"}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {room.trackCount}
              </td>
              <td className="py-2.5 text-right tabular-nums">
                {room.downloadCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
