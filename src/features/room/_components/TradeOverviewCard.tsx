"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useTransition } from "react";

import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ACCEPT_STRING } from "@/lib/upload-constants";
import { useUploadQueue } from "@/features/upload";
import { usePendingUploadStore } from "@/stores/pendingUpload";
import { approveRoom, cancelRoom } from "../actions";
import { SideColumn } from "./TradeOverviewSideColumn";

import type { ParticipantRole, Room, Track } from "@/types/room";

const MAX_SLOTS = 5;

export interface UploadActivity {
  name: string;
  percentage: number;
}

interface TradeOverviewCardProps {
  room: Room;
  role: ParticipantRole;
  secret: string;
  tracks: Track[];
  onUploadActivity?: (items: UploadActivity[]) => void;
}

export function TradeOverviewCard({ room, role, secret, tracks, onUploadActivity }: TradeOverviewCardProps) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const sortByUpload = (a: Track, b: Track) =>
    new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
  const creatorTracks = tracks.filter((t) => t.role === "creator").sort(sortByUpload);
  const joinerTracks = tracks.filter((t) => t.role === "joiner").sort(sortByUpload);

  const isReviewState =
    room.status === "ready_for_review" ||
    room.status === "a_approved" ||
    room.status === "b_approved";

  const isTerminal =
    room.status === "completed" ||
    room.status === "cancelled" ||
    room.status === "expired" ||
    room.status === "disputed";

  const creatorApproved =
    room.status === "a_approved" || room.creatorApprovedAt !== null;
  const joinerApproved =
    room.status === "b_approved" || room.joinerApprovedAt !== null;
  const hasApproved = role === "creator" ? creatorApproved : joinerApproved;

  const myTracks = role === "creator" ? creatorTracks : joinerTracks;

  const { queue, addFiles, removeItem, abortAll } = useUploadQueue({
    roomId: room.id,
    participantSecret: secret,
    maxSlots: MAX_SLOTS,
    currentTrackCount: myTracks.length,
    onFileComplete: () => toast.success("Track uploaded"),
    onError: (filename, error) => toast.error(`${filename}: ${error}`),
  });

  // Consume files dropped on the homepage (pending upload store)
  const pendingFiles = usePendingUploadStore((s) => s.files);
  const clearPendingFiles = usePendingUploadStore((s) => s.clearFiles);

  useEffect(() => {
    if (pendingFiles.length === 0) return;
    addFiles(pendingFiles);
    clearPendingFiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  useLayoutEffect(() => {
    const active = queue
      .filter((q) => q.status !== "error")
      .map((q) => ({ name: q.file.name, percentage: q.status === "complete" ? 100 : q.progress.percentage }));
    onUploadActivity?.(active);
  }, [queue, onUploadActivity]);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      addFiles(Array.from(fileList));
    },
    [addFiles],
  );

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

  const canUpload = !isTerminal && myTracks.length < MAX_SLOTS;

  return (
    <div
      className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!canUpload) return;
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        multiple
        aria-label="Upload audio tracks"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      <div className="space-y-4 px-8 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch md:gap-0">
          {/* Creator side */}
          <div className="flex min-w-0 md:pr-4">
            <SideColumn
              label="Creator"
              color="text-blue-500"
              bgColor="bg-blue-500/10"
              tracks={creatorTracks}
              approved={isReviewState ? creatorApproved : undefined}
              isOwn={role === "creator"}
              queue={role === "creator" ? queue : []}
              onDropClick={() => inputRef.current?.click()}
              onRemoveItem={removeItem}
              onAbortAll={abortAll}
            />
          </div>
          {/* Joiner side */}
          <div className="flex min-w-0 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
            <SideColumn
              label="Joiner"
              color="text-amber-500"
              bgColor="bg-amber-500/10"
              tracks={joinerTracks}
              approved={isReviewState ? joinerApproved : undefined}
              isOwn={role === "joiner"}
              queue={role === "joiner" ? queue : []}
              onDropClick={() => inputRef.current?.click()}
              onRemoveItem={removeItem}
              onAbortAll={abortAll}
            />
          </div>
        </div>

        {/* Action buttons — only in review states */}
        {isReviewState && (
          <>
            <Separator />
            <div className="flex gap-3">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
