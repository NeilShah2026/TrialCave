import type { NextConfig } from "next";

// Supabase URL is needed in several CSP directives. It's a public value.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// DECISION (S6): Next 16 + Tailwind can require inline styles; we allow
// 'unsafe-inline' for style-src only. script-src stays 'self'. If Next later
// needs a nonce for scripts, add it here rather than loosening script-src.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl}`.trim(),
  `connect-src 'self' ${supabaseUrl}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join("; ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  // DECISION: this app is auth-gated and per-request dynamic, so we disable
  // Next 16's experimental component caching to avoid serving one user's data
  // to another. Correctness over cache hit rate.
  cacheComponents: false,
  // Pin the workspace root so Next doesn't walk up to a stray lockfile in the
  // home directory.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
