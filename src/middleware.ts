import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Optional bearer-token auth for write endpoints.
//
// Enable by setting API_TOKEN in the environment. When set, POST / DELETE /
// PUT / PATCH on /api/* require `Authorization: Bearer <API_TOKEN>`. GET is
// always allowed so the dashboard keeps working; this is a coarse-grained
// gate designed for self-hosted single-tenant deployments, not a full auth
// system (that lands in Sprint 5 with the workspaces + users model).
//
// When API_TOKEN is unset, middleware is a no-op — dev experience unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Path prefixes that remain public even when API_TOKEN is set. Progress stream
// and screenshot asset endpoints are read-only and used by the embedded UI
// over the same origin, so they stay unguarded to avoid forcing every img tag
// to carry a header.
const PUBLIC_PATH_PREFIXES = ["/api/screenshots/", "/api/scans/"] as const;
function isAlwaysAllowed(pathname: string, method: string): boolean {
  if (method === "GET") return true;
  // Allow SSE progress stream even for write-only clients.
  if (method === "GET" && pathname.includes("/events")) return true;
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      // Allow GET on scan detail + screenshots.
      if (method === "GET") return true;
    }
  }
  return false;
}

export function middleware(request: NextRequest) {
  const token = process.env.API_TOKEN;
  if (!token) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (isAlwaysAllowed(pathname, request.method)) return NextResponse.next();
  if (!WRITE_METHODS.has(request.method)) return NextResponse.next();

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : undefined;

  if (!provided || !timingSafeEqual(provided, token)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }

  return NextResponse.next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const config = {
  matcher: "/api/:path*",
};
