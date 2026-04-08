"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import dynamic from "next/dynamic";
import { History } from "lucide-react";

import { ApiError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getInviteCode, getParticipantIdentity } from "@/lib/identity";
import { deriveTimeline } from "../lib/derive-timeline";
import { useRoom } from "../hooks/useRoom";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { ActivityTimeline } from "./ActivityTimeline";
import { CompletedState } from "./CompletedState";
import { ProcessingState } from "./ProcessingState";
import { RoomInfoCard } from "./RoomInfoCard";
import { RoomStatusBadge } from "./RoomStatusBadge";
import { TradeOverviewCard } from "./TradeOverviewCard";
import { TerminalState } from "./TerminalState";
import { TrackUploadingCard } from "./TrackUploadingCard";
import { WaitingState } from "./WaitingState";

const TrackAnalysisCard = dynamic(
  () => import("./TrackAnalysisCard").then((mod) => mod.TrackAnalysisCard),
  {
    loading: () => (
      <div className="h-52 animate-pulse rounded-2xl bg-muted" />
    ),
  },
);

import type { UploadActivity } from "./TradeOverviewCard";

import type { ParticipantRole } from "@/types/room";

type Identity = { secret: string; role: ParticipantRole } | null;

const NOOP_SUBSCRIBE = () => () => {};

/** Cache getSnapshot result to maintain referential equality. */
function useIdentity(roomId: string): Identity {
  const cachedRef = useRef<Identity>(null);
  const roomIdRef = useRef(roomId);

  return useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => {
      if (roomIdRef.current !== roomId) {
        roomIdRef.current = roomId;
        cachedRef.current = getParticipantIdentity(roomId);
      }
      if (cachedRef.current === null) {
        cachedRef.current = getParticipantIdentity(roomId);
      }
      return cachedRef.current;
    },
    () => null,
  );
}

interface RoomViewProps {
  roomId: string;
}

export function RoomView({ roomId }: RoomViewProps) {
  const identity = useIdentity(roomId);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { isConnected, getTrackProgress } = useRoomSocket(roomId, identity?.secret ?? "");
  const { data: room, isLoading, error } = useRoom(roomId, identity?.secret ?? "", { isSocketConnected: isConnected });
  const [uploadingFiles, setUploadingFiles] = useState<UploadActivity[]>([]);
  const handleUploadActivity = useCallback((items: UploadActivity[]) => setUploadingFiles(items), []);

  const timelineEvents = useMemo(
    () => (room ? deriveTimeline(room) : []),
    [room],
  );

  if (!identity) {
    return (
      <Card className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            You don&apos;t have access to this room. If you were invited, use the invite link.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2.5">
            <div className="h-4 w-36 animate-pulse rounded-lg bg-border/30" />
            <div className="h-3 w-24 animate-pulse rounded-lg bg-border/30" />
          </div>
          <div className="h-7 w-24 animate-pulse rounded-full bg-border/30" />
        </div>

        {/* Main content skeleton */}
        <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
          <div className="h-52 animate-pulse rounded-2xl bg-border/30" />
        </div>

        {/* Secondary skeleton */}
        <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
          <div className="h-36 animate-pulse rounded-2xl bg-border/30" />
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.kind === "gone") {
    const expiredRoom = {
      id: roomId,
      status: "expired" as const,
      inviteToken: "",
      inviteUsed: true,
      createdAt: "",
      completedAt: null,
      expiresAt: null,
      joinedAt: null,
      creatorApprovedAt: null,
      joinerApprovedAt: null,
      cancellationReason: null,
      cancelledBy: null,
      cancelledAt: null,
    };
    return <TerminalState room={expiredRoom} />;
  }

  if (error || !room) {
    return (
      <Card className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
        <CardContent className="py-12 text-center">
          <p className="font-medium text-destructive">
            {error?.message ?? "Failed to load room. It may not exist."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            You are the{" "}
            <span className="font-bold text-foreground">
              {identity.role}
            </span>
          </p>
          <div className="flex items-center gap-3">
            {/* Mobile timeline toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-xl hover:bg-muted lg:hidden"
              onClick={() => setIsSheetOpen(true)}
            >
              <History className="h-4 w-4 text-primary" />
              <span className="sr-only">Activity</span>
            </Button>
            <RoomStatusBadge status={room.status} />
          </div>
        </div>

        {/* Room info — always at top */}
        <RoomInfoCard
          inviteCode={room.status === "created" || room.status === "waiting_for_peer" ? (getInviteCode(roomId) ?? undefined) : undefined}
        />

        {/* Status card — between room info and trade overview */}
        {(room.status === "created" || room.status === "waiting_for_peer") && (
          <WaitingState status={room.status} />
        )}
        {room.status === "processing" && <ProcessingState />}
        {room.status === "completed" && (
          <CompletedState
            room={room}
            grants={room.grants ?? []}
            tracks={room.tracks ?? []}
            allDownloadsComplete={room.allDownloadsComplete ?? false}
          />
        )}

        {/* Trade overview — track summary + approve/cancel */}
        <TradeOverviewCard
          room={room}
          role={identity.role}
          secret={identity.secret}
          tracks={room.tracks ?? []}
          onUploadActivity={handleUploadActivity}
        />

        {/* Analyzed tracks — tabbed by role */}
        {((room.tracks?.length ?? 0) > 0 || uploadingFiles.length > 0) && (
          <div className="rounded-2xl bg-card px-8 py-6 shadow-[0_0_12px_rgba(0,0,0,0.1)]">
            <Tabs defaultValue={identity.role}>
              <div className="flex gap-2">
                <TabsList className="h-auto w-full gap-2 rounded-none bg-transparent p-0">
                  <TabsTrigger
                    value="creator"
                    className="h-auto flex-1 gap-2 rounded-xl border-2 border-transparent px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-all data-active:border-blue-500/30 data-active:bg-blue-500/10 data-active:text-blue-600 data-active:shadow-none"
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Creator ({room.tracks?.filter((t) => t.role === "creator").length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="joiner"
                    className="h-auto flex-1 gap-2 rounded-xl border-2 border-transparent px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-all data-active:border-amber-500/30 data-active:bg-amber-500/10 data-active:text-amber-600 data-active:shadow-none"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Joiner ({room.tracks?.filter((t) => t.role === "joiner").length ?? 0})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="creator" className="mt-4 space-y-4">
                {room.tracks
                  ?.filter((t) => t.role === "creator")
                  .map((track) => (
                    <div key={track.id} id={`track-${track.id}`}>
                      <TrackAnalysisCard
                        track={track}
                        progress={getTrackProgress(track.id)}
                      />
                    </div>
                  ))}
                {identity.role === "creator" &&
                  uploadingFiles
                    .filter((f) => !room.tracks?.some((t) => t.originalFilename === f.name))
                    .map((f) => (
                      <TrackUploadingCard key={f.name} filename={f.name} percentage={f.percentage} isCreator />
                    ))}
              </TabsContent>
              <TabsContent value="joiner" className="mt-4 space-y-4">
                {room.tracks
                  ?.filter((t) => t.role === "joiner")
                  .map((track) => (
                    <div key={track.id} id={`track-${track.id}`}>
                      <TrackAnalysisCard
                        track={track}
                        progress={getTrackProgress(track.id)}
                      />
                    </div>
                  ))}
                {identity.role === "joiner" &&
                  uploadingFiles
                    .filter((f) => !room.tracks?.some((t) => t.originalFilename === f.name))
                    .map((f) => (
                      <TrackUploadingCard key={f.name} filename={f.name} percentage={f.percentage} isCreator={false} />
                    ))}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {(room.status === "cancelled" || room.status === "expired" || room.status === "disputed") && (
          <TerminalState room={room} />
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 overflow-hidden rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card lg:block">
        <ActivityTimeline events={timelineEvents} />
      </aside>

      {/* Mobile sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Activity</SheetTitle>
          </SheetHeader>
          <ActivityTimeline events={timelineEvents} showHeader={false} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
