import Link from "next/link";

import { AlertTriangle, Ban, Clock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Room } from "@/types/room";

interface StateVisual {
  icon: typeof Ban;
  title: string;
  iconClass: string;
  bgClass: string;
}

const STATE_CONFIG: Record<string, StateVisual> = {
  cancelled: {
    icon: Ban,
    title: "Room Cancelled",
    iconClass: "text-red-500",
    bgClass: "bg-red-50",
  },
  expired: {
    icon: Clock,
    title: "Room Expired",
    iconClass: "text-muted-foreground",
    bgClass: "bg-gray-100",
  },
  disputed: {
    icon: AlertTriangle,
    title: "Room Disputed",
    iconClass: "text-orange-500",
    bgClass: "bg-orange-50",
  },
};

const FALLBACK_CONFIG = STATE_CONFIG.cancelled;

interface TerminalStateProps {
  room: Room;
}

export function TerminalState({ room }: TerminalStateProps) {
  const config = STATE_CONFIG[room.status] ?? FALLBACK_CONFIG;
  const Icon = config.icon;

  return (
    <Card className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
      <CardHeader className="text-center">
        <div
          className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${config.bgClass}`}
        >
          <Icon className={`h-7 w-7 ${config.iconClass}`} />
        </div>
        <CardTitle className="text-xl font-semibold">{config.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 text-center text-sm text-muted-foreground">
        {room.status === "cancelled" && room.cancellationReason && (
          <p>Reason: {room.cancellationReason}</p>
        )}
        {room.status === "cancelled" && room.cancelledBy && (
          <p>Cancelled by: {room.cancelledBy}</p>
        )}
        {room.status === "expired" && (
          <p>This room has expired and is no longer accessible.</p>
        )}
        {room.status === "disputed" && (
          <p>This trade has been flagged for review.</p>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "rounded-xl",
          })}
        >
          Back to Home
        </Link>
      </CardFooter>
    </Card>
  );
}
