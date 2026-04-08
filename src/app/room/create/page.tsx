import type { Metadata } from "next";

import { CreateRoomCard } from "@/features/room/_components/CreateRoomCard";

export const metadata: Metadata = {
  title: "Create Room — TradeMusic",
};

export default function CreateRoomPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-xl font-semibold">Create a Trade Room</h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Start a secure trade. Share the invite link with your partner.
        </p>
        <CreateRoomCard />
      </div>
    </main>
  );
}
