"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { saveSecret } from "@/lib/identity";
import { joinByCode } from "../actions";

interface JoinByCodeCardProps {
  inviteCode: string;
}

export function JoinByCodeCard({ inviteCode }: JoinByCodeCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      const result = await joinByCode(inviteCode);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      saveSecret("joiner", result.data.roomId, result.data.joinerSecret);
      toast.success("Joined the room!");
      router.replace(`/room/${result.data.roomId}`);
    });
  }

  return (
    <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
      <CardContent className="px-8 pt-8">
        <p className="text-sm text-muted-foreground">
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
