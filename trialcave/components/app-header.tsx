import { AreaHeader } from "@/components/site-header";

/** Admin header. Props kept for call-site compatibility. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AppHeader({ email, homeHref }: { email?: string; homeHref?: string }) {
  return <AreaHeader role="admin" />;
}
