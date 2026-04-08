import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

/**
 * Layered CSRF validation for Route Handlers.
 *
 * Defence layers (checked in order):
 *   1. Sec-Fetch-Site — browser-set, unforgeable by JS
 *   2. Origin header  — present on most same-origin/cross-origin POSTs
 *   3. Referer header — fallback when Origin is absent
 *   4. Reject         — if nothing can verify the source, block the request
 *
 * Server Actions already have built-in CSRF protection from Next.js.
 * Webhook endpoints should use shared-secret auth instead of this function.
 *
 * Returns a 403 response if validation fails, or null if the request is valid.
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) {
    return null;
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return FORBIDDEN;
  }

  // Layer 1: Fetch Metadata (Sec-Fetch-Site)
  // Set by the browser, cannot be forged via JavaScript.
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    if (secFetchSite === "same-origin" || secFetchSite === "none") {
      return null;
    }
    return FORBIDDEN;
  }

  // Layer 2: Origin header
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host === host) return null;
    } catch {
      // Malformed origin — fall through to reject
    }
    return FORBIDDEN;
  }

  // Layer 3: Referer header (fallback when Origin is absent)
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).host === host) return null;
    } catch {
      // Malformed referer — fall through to reject
    }
    return FORBIDDEN;
  }

  // Layer 4: No verifiable source — reject.
  // A legitimate browser fetch() always sends Sec-Fetch-Site or Origin.
  return FORBIDDEN;
}
