import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { handlePreCreate, handlePostFinish } from "@/features/upload/lib/tusd-handler";

import { TusdHookPayloadSchema } from "@/features/upload/types";
import type { TusdHookPayload } from "@/features/upload/types";

const TUSD_HOOK_SECRET = getTusdHookSecret();

function getTusdHookSecret(): string {
  const secret = process.env.TUSD_HOOK_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("TUSD_HOOK_SECRET must be set in production");
  }
  return secret ?? "local-dev-hook-secret";
}

/**
 * Verify the webhook request comes from tusd.
 *
 * Strategy:
 * - If Bearer token is present -> validate against TUSD_HOOK_SECRET (timing-safe)
 * - If no Bearer token -> allow only internal Docker requests (no CF-Connecting-IP header).
 *   Cloudflare always adds CF-Connecting-IP for external traffic, and UFW blocks
 *   non-Cloudflare IPs on ports 80/443. Direct Docker network calls (tusd -> nextjs)
 *   bypass Cloudflare entirely and won't have this header.
 */
function verifyHookSecret(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (token) {
    const tokenBuf = Buffer.from(token, "utf-8");
    const secretBuf = Buffer.from(TUSD_HOOK_SECRET, "utf-8");
    if (tokenBuf.length !== secretBuf.length) return false;
    return timingSafeEqual(tokenBuf, secretBuf);
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    logger.warn("Tusd webhook rejected: external request without Bearer token");
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  if (!verifyHookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TusdHookPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    logger.warn("Invalid tusd webhook payload", { error: parsed.error.message });
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const payload: TusdHookPayload = parsed.data;

  switch (payload.Type) {
    case "pre-create":
      return handlePreCreate(payload);
    case "post-finish":
      return handlePostFinish(payload);
    case "post-terminate":
      logger.info("Upload terminated", {
        uploadId: payload.Event.Upload.ID,
      });
      return NextResponse.json({}, { status: 200 });
    default:
      return NextResponse.json({}, { status: 200 });
  }
}
