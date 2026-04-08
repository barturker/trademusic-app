import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { DashboardStats } from "../types";

interface StatCardsProps {
  stats: DashboardStats;
}

interface StatItem {
  label: string;
  value: number;
  sub?: string;
}

export function StatCards({ stats }: StatCardsProps) {
  const items: StatItem[] = [
    { label: "Total Rooms", value: stats.totalRooms, sub: `${stats.activeRooms} active` },
    { label: "Total Tracks", value: stats.totalTracks, sub: `${stats.tracksProcessing} processing` },
    { label: "Downloads", value: stats.totalDownloads },
    { label: "Last 24h", value: stats.roomsLast24h, sub: "rooms created" },
    { label: "Last 7d", value: stats.roomsLast7d, sub: "rooms created" },
    { label: "Last 30d", value: stats.roomsLast30d, sub: "rooms created" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{item.value}</p>
            {item.sub && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
