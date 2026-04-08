"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { saveInviteCode, saveSecret } from "@/lib/identity";
import { createRoom } from "../actions";

export function CreateRoomCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createRoom();

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      saveSecret("creator", result.data.roomId, result.data.creatorSecret);
      saveInviteCode(result.data.roomId, result.data.inviteCode);
      toast.success("Room created! Share the invite link.");
      router.replace(`/room/${result.data.roomId}`);
    });
  }

  return (
    <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
      <CardContent className="px-8 pt-8">
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            A private room will be created for your trade.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            You will receive a unique invite link to share.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            No account or sign-up required.
          </li>
        </ul>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent px-8 pb-8 pt-4">
        <Button
          className="w-full rounded-xl hover:opacity-90"
          size="lg"
          onClick={handleCreate}
          disabled={pending}
        >
          {pending ? "Creating..." : "Create Room"}
        </Button>
      </CardFooter>
    </div>
  );
}
