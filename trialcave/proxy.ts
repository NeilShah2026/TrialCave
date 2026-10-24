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

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet (early demo setup), don't block routing.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
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

  if (!match) return response;

  // Protected route. Require a session.
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
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
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (role !== match.role) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return response;
}

export const config = {
  // Run on app routes; skip static assets and images.
  // DECISION: inbound-email ingestion (Postmark webhook) is deprecated for now,
  // so there is no /api/inbound route to exclude. Uploads are the ingestion path.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
