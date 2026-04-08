import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";

import type { NextRequest } from "next/server";

interface AdminSessionData {
  isAuthenticated?: boolean;
}

const ADMIN_COOKIE_NAME = "ts_admin_session";
const HSTS_MAX_AGE = 63072000; // 2 years in seconds
const IS_DEV = process.env.NODE_ENV === "development";

function getAdminPath(): string {
  return process.env.ADMIN_PATH ?? "d/overview";
}

function isAdminRoute(pathname: string): boolean {
  const adminPath = getAdminPath();
  return pathname === `/${adminPath}` || pathname.startsWith(`/${adminPath}/`);
}

function isAdminLoginRoute(pathname: string): boolean {
  const adminPath = getAdminPath();
  return pathname === `/${adminPath}/login`;
}

function hasValidGateKey(request: NextRequest): boolean {
  const gateKey = process.env.ADMIN_GATE_KEY;
  if (!gateKey) return false;
  return request.nextUrl.searchParams.get("key") === gateKey;
}

function buildCsp(nonce: string): string {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
  const socketWs = socketUrl.replace(/^http/, "ws");
  const uploadOrigin = new URL(
    process.env.NEXT_PUBLIC_UPLOAD_URL ?? "http://localhost:8080",
  ).origin;

  const scriptSrc = [
    `'self'`,
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    `https://static.cloudflareinsights.com`,
    IS_DEV ? `'unsafe-eval'` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' ${socketUrl} ${socketWs} ${uploadOrigin} https://cloudflareinsights.com https://*.cloudflareinsights.com`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `worker-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    IS_DEV ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

const PERMISSIONS_POLICY = [
  "geolocation=()",
  "microphone=()",
  "camera=()",
  "payment=()",
  "usb=()",
  "bluetooth=()",
  "clipboard-read=()",
].join(", ");

function applySecurityHeaders(request: NextRequest, response: NextResponse): void {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Forward nonce + CSP to Next.js via request headers so the framework
  // can extract the nonce and auto-apply it to inline scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(
    "Strict-Transport-Security",
    `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`,
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set(
    "Cross-Origin-Embedder-Policy-Report-Only",
    "credentialless",
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Admin route protection ---
  if (isAdminRoute(pathname)) {
    const password = process.env.IRON_SESSION_PASSWORD ?? "";
    const response = NextResponse.next();

    const session = await getIronSession<AdminSessionData>(request, response, {
      password,
      cookieName: ADMIN_COOKIE_NAME,
    });

    // Authenticated admin → apply security headers and pass through
    if (session.isAuthenticated) {
      applySecurityHeaders(request, response);
      return response;
    }

    // Login page with valid gate key → allow through with security headers
    if (isAdminLoginRoute(pathname) && hasValidGateKey(request)) {
      const loginResponse = NextResponse.next();
      applySecurityHeaders(request, loginResponse);
      return loginResponse;
    }

    // Everything else → 404
    const notFoundUrl = new URL("/_not-found", request.url);
    return NextResponse.rewrite(notFoundUrl);
  }

  // --- Security headers for all other routes ---
  const response = NextResponse.next();
  applySecurityHeaders(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)",
  ],
};
