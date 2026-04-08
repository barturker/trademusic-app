"use client";

import { useTransition } from "react";

import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { approveRoom, cancelRoom } from "../actions";
import { TrackAnalysisCard } from "./TrackAnalysisCard";

import type { ParticipantRole, Room, Track } from "@/types/room";

interface ReviewStateProps {
  room: Room;
  role: ParticipantRole;
  secret: string;
  tracks: Track[];
}

export function ReviewState({ room, role, secret, tracks }: ReviewStateProps) {
  const [pending, startTransition] = useTransition();

  const hasApproved =
    (role === "creator" &&
      (room.status === "a_approved" || room.creatorApprovedAt !== null)) ||
    (role === "joiner" &&
      (room.status === "b_approved" || room.joinerApprovedAt !== null));

  const otherApproved =
    (role === "creator" &&
      (room.status === "b_approved" || room.joinerApprovedAt !== null)) ||
    (role === "joiner" &&
      (room.status === "a_approved" || room.creatorApprovedAt !== null));

  function handleApprove() {
    startTransition(async () => {
      const result = await approveRoom(room.id, secret);
      if (result.success) {
        toast.success("Approved! Waiting for the other party.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelRoom(room.id, secret, "Cancelled by participant");
      if (result.success) {
        toast.info("Room cancelled.");
      } else {
        toast.error(result.error);
      }
    });
  }

  const creatorTracks = tracks.filter((t) => t.role === "creator");
  const joinerTracks = tracks.filter((t) => t.role === "joiner");

  return (
    <Card className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Review Tracks</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {creatorTracks.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
              Creator Tracks ({creatorTracks.length})
            </p>
            {creatorTracks.map((track) => (
              <TrackAnalysisCard key={track.id} track={track} />
            ))}
          </div>
        )}
        {joinerTracks.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-500">
              Joiner Tracks ({joinerTracks.length})
            </p>
            {joinerTracks.map((track) => (
              <TrackAnalysisCard key={track.id} track={track} />
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                hasApproved ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            />
            <span className="text-muted-foreground">Your approval:</span>
            <span
              className={
                hasApproved
                  ? "font-medium text-emerald-500"
                  : "text-muted-foreground"
              }
            >
              {hasApproved ? "Approved" : "Pending"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                otherApproved ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            />
            <span className="text-muted-foreground">Other party:</span>
            <span
              className={
                otherApproved
                  ? "font-medium text-emerald-500"
                  : "text-muted-foreground"
              }
            >
              {otherApproved ? "Approved" : "Pending"}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3">
        {!hasApproved && (
          <Button
            className="flex-1 gap-2 rounded-xl font-semibold"
            onClick={handleApprove}
            disabled={pending}
          >
            <CheckCircle2 className="h-4 w-4" />
            {pending ? "Approving..." : "Approve Trade"}
          </Button>
        )}
        <Button
          variant="destructive"
          className="flex-1 gap-2 rounded-xl font-semibold"
          onClick={handleCancel}
          disabled={pending}
        >
          <XCircle className="h-4 w-4" />
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
