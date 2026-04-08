import type { Metadata } from "next";

import { JoinByCodeCard } from "@/features/room/_components/JoinByCodeCard";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const metadata: Metadata = {
  title: "Join Room — TradeMusic",
};

export default async function JoinByCodePage({ params }: PageProps) {
  const { code } = await params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-xl font-semibold">Join Trade Room</h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          You have been invited to a secure track trade.
        </p>
        <JoinByCodeCard inviteCode={code} />
      </div>
    </main>
  );
}
