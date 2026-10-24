import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { ROLE_HOME, type Role } from "@/lib/types";

// DECISION (B6.3): Next 16 renames middleware.ts to proxy.ts with an exported
// `proxy` function. Logic matches the spec. Session refresh follows the
// @supabase/ssr request/response cookie pattern.

const ROLE_PREFIX: Array<{ prefix: string; role: Role }> = [
  { prefix: "/app", role: "patient" },
  { prefix: "/clinic", role: "clinic" },
  { prefix: "/enclave", role: "researcher" },
  { prefix: "/admin", role: "admin" },
];

/**
 * DECISION (S6, revised): the old static CSP (`script-src 'self'`) blocked the
 * inline bootstrap scripts Next.js emits, so React never hydrated and no
 * client-side button worked. We now issue a per-request nonce here; Next reads
 * it from the request's CSP header and stamps it on every framework script.
 * `'strict-dynamic'` lets those trusted scripts load their chunks. Dev needs
 * `'unsafe-eval'` (React debug stacks) and a websocket for HMR.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseUrl}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl}${isDev ? " ws: wss:" : ""}`.trim(),
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Forward the nonce + CSP on the request so the renderer can apply it.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const withCsp = <T extends NextResponse>(res: T): T => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  let response = forward();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet (early demo setup), don't block routing.
  if (!url || !anonKey) return withCsp(response);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const match = ROLE_PREFIX.find(
    (r) => path === r.prefix || path.startsWith(`${r.prefix}/`),
  );

  if (!match) return withCsp(response);

  // Protected route. Require a session.
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  // Check the role against the route's required role.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as Role | undefined;

  if (!role) {
    // Signed in but no profile: send to login to resolve.
    return withCsp(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (role !== match.role) {
    return withCsp(NextResponse.redirect(new URL(ROLE_HOME[role], request.url)));
  }

  return withCsp(response);
}

export const config = {
  // Run on app routes; skip static assets and images.
  // DECISION: inbound-email ingestion (Postmark webhook) is deprecated for now,
  // so there is no /api/inbound route to exclude. Uploads are the ingestion path.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
