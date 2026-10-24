import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Clinic Agreement" };

export default function ClinicAgreementPage() {
  return (
    <LegalLayout
      title="Clinic Agreement"
      current="/legal/clinic-agreement"
      summary="Research clinics can reach pre-qualified participants through TrialCave, but only with IRB-approved text, only after TrialCave verifies the clinic, and only with the fields each patient chooses to share."
      sections={[
        {
          id: "verification",
          title: "Verification",
          body: <p>A clinic must be verified by TrialCave before it can send invitations. Verification includes confirming the organization and that an IRB approval letter is on file for each study.</p>,
        },
        {
          id: "irb",
          title: "IRB approval of patient-facing text",
          body: <p>Every study summary and invitation shown to patients must be approved by the study&apos;s IRB. The clinic attests to this when it saves a study and again whenever the invitation text changes.</p>,
        },
        {
          id: "anonymous",
          title: "Anonymous until approved",
          body: (
            <ul>
              <li>Before a patient approves, the clinic sees only a count of people who meet the criteria. Small counts are shown as &quot;fewer than 5&quot;.</li>
              <li>Declines are never identified.</li>
              <li>The clinic must not contact a patient outside TrialCave&apos;s routing before that patient approves.</li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "Use of shared data",
          body: <p>Fields a patient shares may be used only to contact that patient about the stated study and to screen them for it. When a patient stops sharing, the clinic loses access right away.</p>,
        },
        {
          id: "no-reid",
          title: "No re-identification",
          body: <p>The clinic must not try to identify anyone from counts, equity summaries, or any other aggregate information.</p>,
        },
        {
          id: "limits",
          title: "Rate limits and audit",
          body: <p>Invitations can be sent once per study every 24 hours, and only to people who meet the study&apos;s criteria and opted in. Every view of a patient&apos;s shared report is logged.</p>,
        },
        {
          id: "final",
          title: "Final eligibility",
          body: <p>TrialCave pre-screens only. The study team must confirm eligibility using its own screening process.</p>,
        },
      ]}
    />
  );
}
