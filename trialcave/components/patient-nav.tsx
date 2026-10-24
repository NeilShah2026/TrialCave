import { AreaHeader } from "@/components/site-header";

/** Patient area header. `email` is kept for call-site compatibility. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PatientNav({ email }: { email?: string }) {
  return <AreaHeader role="patient" />;
}
