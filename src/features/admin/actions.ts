"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { getIronSession } from "iron-session";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

import {
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_MS,
  getSessionOptions,
} from "./types";

import type { AdminSessionData } from "./types";

interface LoginResult {
  error?: string;
}

/** Verify admin secret, enforce rate limit, and create encrypted session. */
export async function loginAdmin(formData: FormData): Promise<LoginResult> {
  const headerMap = await headers();
  const ip = getClientIpFromHeaders(headerMap);

  // Rate limit check
  const rateLimitKey = `admin-login:${ip}`;
  const rateResult = checkRateLimit(
    rateLimitKey,
    LOGIN_RATE_LIMIT,
    LOGIN_RATE_WINDOW_MS,
  );

  if (!rateResult.allowed) {
    const retryInMinutes = Math.ceil(
      (rateResult.resetAt - Date.now()) / 60_000,
    );
    logger.warn("Admin login rate limited", { ip, retryInMinutes });
    return {
      error: `Too many attempts. Try again in ${retryInMinutes} minute${retryInMinutes > 1 ? "s" : ""}.`,
    };
  }

  const secret = formData.get("secret");
  if (typeof secret !== "string" || secret.length === 0) {
    return { error: "Secret is required" };
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(env.ADMIN_SECRET, "utf8");
  const provided = Buffer.from(secret, "utf8");

  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    logger.warn("Admin login failed: invalid secret", { ip });
    return { error: "Invalid secret" };
  }

  // Create encrypted session via iron-session
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(
    cookieStore,
    getSessionOptions(),
  );

  session.isAuthenticated = true;
  await session.save();

  logger.info("Admin login successful", { ip });
  redirect(`/${env.ADMIN_PATH}`);
}

/** Destroy session and redirect to login. */
export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(
    cookieStore,
    getSessionOptions(),
  );

  session.destroy();
  redirect(`/${env.ADMIN_PATH}/login?key=${env.ADMIN_GATE_KEY}`);
}

/** Validate the admin session. Returns true if authenticated. */
export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(
    cookieStore,
    getSessionOptions(),
  );

  return session.isAuthenticated === true;
}
