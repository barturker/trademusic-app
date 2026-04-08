import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AdminRoomDetail } from "../types";
import type { RoomStatus } from "@/types/room";

interface RoomDetailProps {
  room: AdminRoomDetail;
}

const STATUS_VARIANTS: Record<RoomStatus, "default" | "secondary" | "destructive" | "outline"> = {
  created: "outline",
  waiting_for_peer: "secondary",
  processing: "default",
  ready_for_review: "secondary",
  a_approved: "secondary",
  b_approved: "secondary",
  completed: "default",
  cancelled: "destructive",
  disputed: "destructive",
  expired: "outline",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function RoomDetail({ room }: RoomDetailProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Room info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{room.id}</span>
            <Badge variant={STATUS_VARIANTS[room.status]}>
              {room.status.replace(/_/g, " ")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(room.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{formatDate(room.joinedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd>{formatDate(room.completedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expires</dt>
              <dd>{formatDate(room.expiresAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Creator Approved</dt>
              <dd>{formatDate(room.creatorApprovedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joiner Approved</dt>
              <dd>{formatDate(room.joinerApprovedAt)}</dd>
            </div>
            {room.cancelledAt && (
              <>
                <div>
                  <dt className="text-muted-foreground">Cancelled At</dt>
                  <dd>{formatDate(room.cancelledAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cancelled By</dt>
                  <dd>{room.cancelledBy ?? "—"}</dd>
                </div>
                {room.cancellationReason && (
                  <div className="col-span-full">
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd>{room.cancellationReason}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Tracks */}
      <Card>
        <CardHeader>
          <CardTitle>Tracks ({room.tracks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {room.tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracks uploaded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2 pr-4">Filename</th>
                    <th className="pb-2 pr-4">Size</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">BPM</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {room.tracks.map((track) => (
                    <tr key={track.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 capitalize">{track.role}</td>
                      <td className="py-2 pr-4 max-w-[200px] truncate" title={track.originalFilename}>
                        {track.originalFilename}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{formatBytes(track.fileSizeBytes)}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatDuration(track.durationSeconds)}</td>
                      <td className="py-2 pr-4 tabular-nums">{track.bpm ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={
                            track.processingStatus === "completed"
                              ? "default"
                              : track.processingStatus === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {track.processingStatus}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{formatDate(track.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Download grants */}
      <Card>
        <CardHeader>
          <CardTitle>Download Grants ({room.grants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {room.grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No download grants</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2 pr-4">Downloaded</th>
                    <th className="pb-2 pr-4">Count</th>
                    <th className="pb-2 pr-4">Expires</th>
                    <th className="pb-2">Downloaded At</th>
                  </tr>
                </thead>
                <tbody>
                  {room.grants.map((grant) => (
                    <tr key={grant.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 capitalize">{grant.participantRole}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={grant.downloaded ? "default" : "outline"}>
                          {grant.downloaded ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {grant.downloadCount}/{grant.maxDownloads}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatDate(grant.expiresAt)}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(grant.downloadedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
