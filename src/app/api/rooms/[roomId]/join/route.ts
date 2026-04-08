import { type NextRequest, NextResponse } from "next/server";

import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { joinRoomCore } from "@/features/room/lib/room-operations";
import { RoomIdSchema, InviteTokenSchema } from "@/features/room/types";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_JOIN_ERROR = "Invalid or expired invite link.";

export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfError = validateOrigin(request);
  if (csrfError) return csrfError;

  const ip = getClientIp(request);
  const limit = checkRateLimit(`join-room:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const { roomId: rawRoomId } = await params;

  const roomIdResult = RoomIdSchema.safeParse(rawRoomId);
  if (!roomIdResult.success) {
    return NextResponse.json({ error: GENERIC_JOIN_ERROR }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: GENERIC_JOIN_ERROR }, { status: 400 });
  }

  const rawToken =
    typeof body === "object" && body !== null && "inviteToken" in body
      ? String((body as { inviteToken: unknown }).inviteToken)
      : "";

  const tokenResult = InviteTokenSchema.safeParse(rawToken);
  if (!tokenResult.success) {
    return NextResponse.json({ error: GENERIC_JOIN_ERROR }, { status: 400 });
  }

  const result = await joinRoomCore(roomIdResult.data, tokenResult.data);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
