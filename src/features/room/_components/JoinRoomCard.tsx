"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { parseTokenFromHash, saveSecret } from "@/lib/identity";
import { joinRoom } from "../actions";

interface JoinRoomCardProps {
  roomId: string;
}

export function JoinRoomCard({ roomId }: JoinRoomCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const inviteToken = useMemo(
    () => (typeof window !== "undefined" ? parseTokenFromHash(window.location.hash) : ""),
    [],
  );

  if (!inviteToken) {
    return (
      <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card px-8 py-12 text-center text-muted-foreground">
        <p>Invalid invite link. Please ask the room creator for a new link.</p>
      </div>
    );
  }

  function handleJoin() {
    startTransition(async () => {
      const result = await joinRoom(roomId, inviteToken);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      saveSecret("joiner", roomId, result.data.joinerSecret);
      toast.success("Joined the room!");
      router.replace(`/room/${roomId}`);
    });
  }

  return (
    <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
      <CardContent className="px-8 pt-8">
        <p className="text-sm text-muted-foreground">
          Joining room{" "}
          <span className="font-mono font-bold text-primary">
            {roomId.slice(0, 8)}...
          </span>
        </p>
        <p className="mt-2.5 text-sm text-muted-foreground">
          By joining, you agree to participate in a mutual track trade.
        </p>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent px-8 pb-8 pt-4">
        <Button
          className="w-full rounded-xl hover:opacity-90"
          size="lg"
          onClick={handleJoin}
          disabled={pending}
        >
          {pending ? "Joining..." : "Join Room"}
        </Button>
      </CardFooter>
    </div>
  );
}
