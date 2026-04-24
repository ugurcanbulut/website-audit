import type { NextConfig } from "next";

// Dogfood: these are exactly the headers our own scanner flags as missing on
// audited sites. Values picked for a SPA that loads PhotoSwipe from npm,
// Google-Fonts-free (fonts are vendored under /public/fonts), and uses
// inline + data: URLs only for scanned-site screenshot imagery.
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js emits inline bootstrap scripts; SPA requires 'unsafe-inline'
      // for the route-transition hydration payload.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // shadcn + Tailwind + next-themes inline attribute-style updates
      "style-src 'self' 'unsafe-inline'",
      // Screenshots are served from /api/screenshots/... on same origin.
      // data: permits PhotoSwipe thumbnails.
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // SSE endpoint + optional AI provider endpoints if called from browser
      "connect-src 'self' https://api.anthropic.com https://api.openai.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/screenshots/:path*",
        destination: "/api/screenshots/:path*",
      },
    ];
  },
};

export default nextConfig;
