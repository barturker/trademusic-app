"use client";

import { History } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { TimelineEventRow } from "./TimelineEventRow";

import type { TimelineEvent } from "../types";

interface ActivityTimelineProps {
  events: TimelineEvent[];
  showHeader?: boolean;
}

export function ActivityTimeline({ events, showHeader = true }: ActivityTimelineProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card">
      {showHeader && (
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <History className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        </div>
      )}

      <ScrollArea className="flex-1 px-4 pt-4">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity yet
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((event, idx) => (
              <TimelineEventRow
                key={event.id}
                event={event}
                isLast={idx === events.length - 1}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
