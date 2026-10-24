"use client";

import { usePathname } from "next/navigation";

/**
 * Hides site-wide chrome (demo banner, footer) on full-screen pages like
 * /login. Those pages render their own demo notice and disclaimer line, so
 * B0 rules 4 and 5 still hold.
 */
const BARE_ROUTES = ["/login"];

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (BARE_ROUTES.includes(pathname)) return null;
  return <>{children}</>;
}
