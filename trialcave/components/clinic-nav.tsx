import { AreaHeader } from "@/components/site-header";

/** Clinic area header; shows the clinic's name as the area label. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ClinicNav({ email, clinicName }: { email?: string; clinicName?: string }) {
  return <AreaHeader role="clinic" subtitle={clinicName} />;
}
