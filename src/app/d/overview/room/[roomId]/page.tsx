import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { RoomDetail } from "@/features/admin/_components/RoomDetail";
import { getAdminRoomDetail } from "@/features/admin/queries";
import { env } from "@/lib/env";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Room Detail — TradeMusic Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function AdminRoomDetailPage({ params }: PageProps) {
  const { roomId } = await params;
  const room = await getAdminRoomDetail(roomId);

  if (!room) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/${env.ADMIN_PATH}`}>
          <Button variant="outline" size="sm">
            &larr; Back to Dashboard
          </Button>
        </Link>
      </div>

      <RoomDetail room={room} />
    </main>
  );
}
