import type { NextConfig } from "next";

// DECISION (S6, revised): the Content-Security-Policy is set per request in
// proxy.ts with a nonce. A static `script-src 'self'` here blocked Next's
// inline bootstrap scripts, so nothing hydrated and no button worked.
const securityHeaders = [
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
  // DECISION: record uploads go through a server action. The 1 MB default
  // rejected most phone photos and PDFs. Allow up to 5 files at MAX_UPLOAD_MB
  // each (per-file size is still enforced server-side in lib/ingest/upload.ts).
  experimental: {
    serverActions: {
      bodySizeLimit: `${Number(process.env.MAX_UPLOAD_MB ?? 10) * 5 + 1}mb`,
    },
  },
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
