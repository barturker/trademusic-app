import type { Metadata } from "next";

import { JoinRoomCard } from "@/features/room/_components/JoinRoomCard";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export const metadata: Metadata = {
  title: "Join Room — TradeMusic",
};

export default async function JoinRoomPage({ params }: PageProps) {
  const { roomId } = await params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-xl font-semibold">Join Trade Room</h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          You have been invited to a secure track trade.
        </p>
        <JoinRoomCard roomId={roomId} />
      </div>
    </main>
  );
}
