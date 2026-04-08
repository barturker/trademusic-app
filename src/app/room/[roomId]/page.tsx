import Link from "next/link";

import { TradeSyncLogo } from "@/components/TradeSyncLogo";
import { RoomView } from "@/features/room/_components/RoomView";

import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { roomId } = await params;
  return { title: `Room ${roomId.slice(0, 8)} — TradeMusic` };
}

export default async function RoomPage({ params }: PageProps) {
  const { roomId } = await params;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="w-full max-w-2xl lg:max-w-5xl">
        <header className="mb-6">
          <Link href="/" className="transition-opacity hover:opacity-70">
            <TradeSyncLogo className="h-7 w-auto text-foreground" />
          </Link>
        </header>
        <RoomView roomId={roomId} />
      </div>
    </main>
  );
}
