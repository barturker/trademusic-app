"use client";

import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  PartyPopper,
  Upload,
  UserPlus,
  XCircle,
  Plus,
  ThumbsUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { RelativeTime } from "./RelativeTime";

import type { LucideIcon } from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "../types";

interface EventConfig {
  icon: LucideIcon;
  className: string;
  bg: string;
}

const EVENT_CONFIG: Record<TimelineEventType, EventConfig> = {
  room_created: { icon: Plus, className: "text-blue-500", bg: "bg-blue-50" },
  participant_joined: { icon: UserPlus, className: "text-amber-500", bg: "bg-amber-50" },
  track_uploaded: { icon: Upload, className: "text-cyan-500", bg: "bg-cyan-50" },
  analysis_completed: { icon: CheckCircle2, className: "text-purple-500", bg: "bg-purple-50" },
  analysis_failed: { icon: XCircle, className: "text-red-500", bg: "bg-red-50" },
  creator_approved: { icon: ThumbsUp, className: "text-emerald-500", bg: "bg-emerald-50" },
  joiner_approved: { icon: ThumbsUp, className: "text-emerald-500", bg: "bg-emerald-50" },
  room_completed: { icon: PartyPopper, className: "text-green-500", bg: "bg-green-50" },
  room_cancelled: { icon: Ban, className: "text-red-500", bg: "bg-red-50" },
  room_expired: { icon: Clock, className: "text-muted-foreground", bg: "bg-gray-100" },
  download_granted: { icon: Download, className: "text-green-500", bg: "bg-green-50" },
  track_downloaded: { icon: Download, className: "text-cyan-500", bg: "bg-cyan-50" },
};

/** Role-based accent colors */
const ROLE_COLORS = {
  creator: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-600",
    badge: "bg-blue-100",
  },
  joiner: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-600",
    badge: "bg-amber-100",
  },
} as const;

interface TimelineEventRowProps {
  event: TimelineEvent;
  isLast: boolean;
}

export function TimelineEventRow({ event, isLast }: TimelineEventRowProps) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;
  const roleColors = event.role ? ROLE_COLORS[event.role] : null;

  return (
    <div className="relative flex gap-3">
      {/* Vertical line connector */}
      {!isLast && (
        <div className="absolute top-8 left-[15px] h-[calc(100%-8px)] w-px bg-border" />
      )}

      {/* Icon in clean circle */}
      <div
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          config.bg,
          config.className,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg pb-4",
          roleColors && [roleColors.bg, roleColors.border, "border px-3 py-2"],
        )}
      >
        <div className="flex items-center gap-1.5">
          {roleColors && (
            <span className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              roleColors.badge,
              roleColors.text,
            )}>
              {event.role}
            </span>
          )}
          <p className="truncate text-sm font-medium leading-tight text-foreground">
            {event.label}
          </p>
        </div>
        {event.metadata?.filename && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {event.metadata.filename}
          </p>
        )}
        <div className="mt-1">
          <RelativeTime timestamp={event.timestamp} />
        </div>
      </div>
    </div>
  );
}
