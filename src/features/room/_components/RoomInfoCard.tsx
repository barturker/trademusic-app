"use client";

import { useState } from "react";

import { Check, Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildInviteUrl } from "@/lib/identity";

interface RoomInfoCardProps {
  inviteCode?: string;
}

const COPY_RESET_DELAY_MS = 2000;

export function RoomInfoCard({ inviteCode }: RoomInfoCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = inviteCode ? buildInviteUrl(inviteCode) : null;

  if (!inviteUrl) return null;

  async function handleCopyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), COPY_RESET_DELAY_MS);
  }

  return (
    <div className="rounded-2xl shadow-[0_0_12px_rgba(0,0,0,0.1)] bg-card">
      <CardHeader className="px-8">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Link2 className="h-5 w-5 text-primary" />
          Share Invite Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-8 pb-8">
        <p className="text-sm text-muted-foreground">
          Send this link to your trading partner. It can only be used once.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-xl bg-wt-code-bg px-4 py-2.5 font-mono text-sm text-foreground">
            {inviteUrl}
          </code>
          <Button
            variant="outline"
            size="icon"
            className={
              copiedLink
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : "border-border hover:bg-muted"
            }
            onClick={handleCopyLink}
          >
            {copiedLink ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {copiedLink && (
          <p className="text-sm font-medium text-emerald-500">
            Copied to clipboard
          </p>
        )}
      </CardContent>
    </div>
  );
}
