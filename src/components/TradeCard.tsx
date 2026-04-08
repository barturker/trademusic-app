"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { toast } from "sonner";

import { AddFilesIcon } from "@/components/wt-icons";
import { saveInviteCode, saveSecret } from "@/lib/identity";
import { createRoom } from "@/features/room/actions";

type Tab = "new-trade" | "join-room";

/** Parse user input: short invite code, short invite URL, or legacy invite URL. */
function parseInviteInput(
  input: string,
): { type: "code"; code: string } | { type: "invite"; roomId: string; token: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try parsing as URL
  try {
    const url = new URL(trimmed);

    // New short invite URL: /j/{code}
    const shortMatch = url.pathname.match(/\/j\/([A-Za-z0-9_-]+)/);
    if (shortMatch?.[1]) {
      return { type: "code", code: shortMatch[1] };
    }

    // Legacy invite URL: /room/{id}/join#token={token}
    const legacyMatch = url.pathname.match(/\/room\/([^/]+)\/join/);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const token = hashParams.get("token") ?? url.searchParams.get("token");
    if (legacyMatch?.[1] && token) {
      return { type: "invite", roomId: legacyMatch[1], token };
    }
  } catch {
    // Not a valid URL — fall through
  }

  // Bare invite code (13 chars, URL-safe alphabet)
  if (/^[A-Za-z0-9_-]{13}$/.test(trimmed)) {
    return { type: "code", code: trimmed };
  }

  return null;
}

export function TradeCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<Tab>("new-trade");
  const [inviteLink, setInviteLink] = useState("");

  // Smooth height animation for tab content
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  const measureHeight = useCallback(() => {
    const el = contentRef.current;
    if (el) setContentHeight(el.scrollHeight);
  }, []);

  useEffect(() => {
    measureHeight();
  }, [activeTab, measureHeight]);

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
      router.push(`/room/${result.data.roomId}`);
    });
  }

  function handleJoin() {
    const parsed = parseInviteInput(inviteLink);
    if (!parsed) {
      toast.error("Enter a valid invite link or room ID.");
      return;
    }

    if (parsed.type === "code") {
      router.push(`/j/${parsed.code}`);
    } else {
      router.push(`/room/${parsed.roomId}/join?token=${parsed.token}`);
    }
  }

  const tabClass = (tab: Tab) => {
    const isActive = activeTab === tab;
    const isCreate = tab === "new-trade";
    const activeColor = isCreate
      ? "border-blue-500/30 bg-blue-500/10 text-blue-600 font-semibold"
      : "border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold";
    const inactiveColor = "border-transparent bg-transparent text-muted-foreground font-normal hover:text-foreground";
    return (
      `flex-1 h-[41px] flex items-center justify-center gap-1.5 ` +
      `border-2 rounded-xl cursor-pointer text-sm transition-all ` +
      (isActive ? activeColor : inactiveColor)
    );
  };

  return (
    <div
      className={
        "absolute z-30 left-[80px] top-1/2 -translate-y-1/2 w-[280px] " +
        "bg-white rounded-2xl flex flex-col overflow-hidden " +
        "shadow-[0_0_12px_rgba(0,0,0,0.1)] " +
        "max-md:relative max-md:left-auto max-md:top-auto max-md:translate-y-0 " +
        "max-md:mx-4 max-md:w-auto"
      }
    >
      {/* Tab bar */}
      <div className="flex w-full gap-2 px-2.5 pt-2.5">
        <button
          type="button"
          aria-label="New Trade tab"
          aria-pressed={activeTab === "new-trade"}
          onClick={() => setActiveTab("new-trade")}
          className={tabClass("new-trade")}
        >
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          New Trade
        </button>
        <button
          type="button"
          aria-label="Join Room tab"
          aria-pressed={activeTab === "join-room"}
          onClick={() => setActiveTab("join-room")}
          className={tabClass("join-room")}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Join Room
        </button>
      </div>

      <div
        className="overflow-hidden transition-[height] duration-300 ease-in-out"
        style={{ height: contentHeight !== undefined ? `${contentHeight}px` : "auto" }}
      >
        <div ref={contentRef}>
      {activeTab === "new-trade" ? (
        /* New Trade tab body */
        <div className="flex flex-1 flex-col">
          {/* Upload zone style */}
          <div className="flex gap-1 px-2.5 pt-2.5">
            <button
              type="button"
              aria-label="Upload tracks to create a new trade room"
              onClick={handleCreate}
              disabled={pending}
              className={
                "flex-1 h-[70px] flex flex-col items-center justify-center " +
                "gap-2 bg-secondary rounded-lg border-none cursor-pointer " +
                "transition-colors duration-150 hover:bg-wt-blue-light-hover " +
                "disabled:opacity-50 disabled:cursor-not-allowed"
              }
            >
              <AddFilesIcon className="size-8" />
              <span className="text-xs font-medium text-secondary-foreground">
                {pending ? "Creating..." : "Upload tracks"}
              </span>
            </button>
          </div>

          {/* Info section */}
          <div className="px-2.5 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create a private room. Both parties upload tracks,
              preview snippets, and approve the trade. Tracks unlock simultaneously.
            </p>
          </div>

          {/* Features */}
          <div className="flex-1 overflow-hidden px-2.5">
            {["Encrypted at rest", "Full spectrogram analysis", "Preview 30s before trading", "Both sides must approve", "24h to download after trade"].map(
              (feature, i) => (
                <div
                  key={feature}
                  className={
                    "flex h-[40px] items-center px-2.5 text-sm text-wt-dark " +
                    (i < 4 ? "border-b border-border" : "")
                  }
                >
                  {feature}
                </div>
              ),
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-3 pb-3 pt-2.5">
            <button
              type="button"
              aria-label="Create a new trade room"
              onClick={handleCreate}
              disabled={pending}
              className={
                "w-full h-12 rounded-2xl border-none " +
                "bg-primary text-primary-foreground text-base font-medium " +
                "cursor-pointer transition-colors duration-150 " +
                "hover:bg-wt-blue-hover disabled:opacity-50 disabled:cursor-not-allowed"
              }
            >
              {pending ? "Creating..." : "Create a Room"}
            </button>
          </div>
        </div>
      ) : (
        /* Join Room tab body */
        <div className="flex flex-1 flex-col">
          {/* Info section */}
          <div className="px-2.5 pt-2.5 pb-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Paste an invite link to join an existing trade room.
            </p>
          </div>

          {/* Invite link input */}
          <div className="px-2.5 pb-2.5">
            <input
              type="text"
              aria-label="Invite link"
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
              placeholder="Paste invite link..."
              className={
                "w-full h-10 px-3 rounded-lg border border-border " +
                "text-sm text-wt-dark placeholder:text-wt-placeholder " +
                "outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 " +
                "transition-colors duration-150"
              }
            />
          </div>

          {/* Features */}
          <div className="flex-1 overflow-hidden px-2.5">
            {["Encrypted at rest", "Full spectrogram analysis", "Preview 30s before trading", "Both sides must approve", "24h to download after trade"].map(
              (feature, i) => (
                <div
                  key={feature}
                  className={
                    "flex h-[40px] items-center px-2.5 text-sm text-wt-dark " +
                    (i < 4 ? "border-b border-border" : "")
                  }
                >
                  {feature}
                </div>
              ),
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-3 pb-3 pt-2.5">
            <button
              type="button"
              aria-label="Join an existing trade room"
              onClick={handleJoin}
              disabled={!inviteLink.trim()}
              className={
                "w-full h-12 rounded-2xl border-none " +
                "bg-amber-500 text-white text-base font-medium " +
                "cursor-pointer transition-colors duration-150 " +
                "hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              }
            >
              Join Room
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
