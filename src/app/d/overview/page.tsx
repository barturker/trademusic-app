import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCards } from "@/features/admin/_components/StatCards";
import { StatusBreakdown } from "@/features/admin/_components/StatusBreakdown";
import { ActivityTable } from "@/features/admin/_components/ActivityTable";
import { LogoutButton } from "@/features/admin/_components/LogoutButton";
import { getDashboardStats, getRecentRooms } from "@/features/admin/queries";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard — TradeMusic",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, recentRooms] = await Promise.all([
    getDashboardStats(),
    getRecentRooms(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            System overview and recent activity
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Stat cards */}
      <section className="mb-6">
        <StatCards stats={stats} />
      </section>

      {/* Status breakdown */}
      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Room Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown breakdown={stats.statusBreakdown} />
            {stats.tracksFailed > 0 && (
              <p className="mt-3 text-sm text-destructive">
                {stats.tracksFailed} track{stats.tracksFailed > 1 ? "s" : ""} failed processing
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent activity */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTable rooms={recentRooms} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
