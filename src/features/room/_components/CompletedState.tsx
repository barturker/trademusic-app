"use client";

import { useEffect, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { DownloadGrant, Room, Track } from "@/types/room";

const REFRESH_INTERVAL_MS = 30_000;
const URGENCY_THRESHOLD_HOURS = 6;
const CRITICAL_THRESHOLD_HOURS = 1;

interface CompletedStateProps {
  room: Room;
  grants: DownloadGrant[];
  tracks: Track[];
  allDownloadsComplete: boolean;
}

export function CompletedState({
  room,
  grants,
  tracks,
  allDownloadsComplete,
}: CompletedStateProps) {
  const [, setTick] = useState(0);

  // Auto-refresh countdown display every 30s
  useEffect(() => {
    if (allDownloadsComplete) return;
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [allDownloadsComplete]);

  function getTrackForGrant(grant: DownloadGrant): Track | undefined {
    return tracks.find((t) => t.id === grant.trackId);
  }

  function handleDownload(grant: DownloadGrant) {
    window.open(`/api/rooms/${room.id}/download?token=${grant.token}`, "_blank");
  }

  // Derive banner state from grants
  const now = new Date();
  const activeGrants = grants.filter(
    (g) => !g.downloaded && new Date(g.expiresAt) > now,
  );
  const hasAnyDownloadable = activeGrants.length > 0;

  let iconColor = "text-emerald-500";
  let bgColor = "bg-emerald-500/10";
  let title = "Trade Complete";
  let subtitle: string;
  let showClock = false;

  if (allDownloadsComplete) {
    subtitle = "Both parties have downloaded. This room will be cleaned up automatically.";
  } else if (hasAnyDownloadable) {
    showClock = true;
    const earliestExpiry = new Date(
      Math.min(...activeGrants.map((g) => new Date(g.expiresAt).getTime())),
    );
    const hoursRemaining =
      (earliestExpiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    const distance = formatDistanceToNow(earliestExpiry);

    if (hoursRemaining <= CRITICAL_THRESHOLD_HOURS) {
      iconColor = "text-red-500";
      bgColor = "bg-red-500/10";
      subtitle = `Download links expire in ${distance}. Download now.`;
    } else if (hoursRemaining <= URGENCY_THRESHOLD_HOURS) {
      iconColor = "text-amber-500";
      bgColor = "bg-amber-500/10";
      subtitle = `Download links expire in ${distance}.`;
    } else {
      subtitle = `Download links expire in ${distance}.`;
    }
  } else {
    iconColor = "text-red-500";
    bgColor = "bg-red-500/10";
    title = "Downloads Unavailable";
    subtitle = "All download links have expired.";
  }

  const Icon = showClock ? Clock : CheckCircle2;

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[0_0_12px_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            bgColor,
          )}
        >
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {grants.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {grants.map((grant) => {
            const track = getTrackForGrant(grant);
            const isExpired = new Date(grant.expiresAt) < new Date();
            const isUsed =
              grant.downloaded || grant.downloadCount >= grant.maxDownloads;
            const canDownload = !isExpired && !isUsed;

            return (
              <div
                key={grant.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {track?.originalFilename ?? "Unknown track"}
                </span>
                <Button
                  size="sm"
                  variant={canDownload ? "default" : "ghost"}
                  className="shrink-0 gap-1.5 rounded-lg"
                  disabled={!canDownload}
                  onClick={() => handleDownload(grant)}
                >
                  <Download className="h-3.5 w-3.5" />
                  {isUsed ? "Downloaded" : isExpired ? "Expired" : "Download"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
