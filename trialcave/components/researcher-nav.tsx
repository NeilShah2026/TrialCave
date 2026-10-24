import { AreaHeader } from "@/components/site-header";

/** Research partner header; shows the organization as the area label. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ResearcherNav({ email, orgName }: { email?: string; orgName?: string }) {
  return <AreaHeader role="researcher" subtitle={orgName} />;
}
