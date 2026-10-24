import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Research Partner Agreement" };

export default function ResearchPartnerAgreementPage() {
  return (
    <LegalLayout
      title="Research Partner Agreement"
      current="/legal/research-partner-agreement"
      summary="Research partners run approved, predefined analyses inside the TrialCave Enclave and take out group results only. They never see, receive, or download individual records."
      sections={[
        {
          id: "approved",
          title: "Approved analyses only",
          body: <p>Each project is approved by TrialCave for specific data types, a research type, and a list of predefined analyses. Only those analyses can be run, and only on Donors who consented to that combination.</p>,
        },
        {
          id: "aggregates",
          title: "Aggregate results only",
          body: (
            <ul>
              <li>Results are group statistics. Any group with fewer than 10 people is hidden.</li>
              <li>Only aggregate tables can be exported. Raw-record download is disabled and every attempt is logged.</li>
            </ul>
          ),
        },
        {
          id: "no-reid",
          title: "No re-identification attempts",
          body: <p>Partners must not try to identify any person, including by combining results across runs or with outside data.</p>,
        },
        {
          id: "publication",
          title: "Publication",
          body: <p>Partners may publish aggregate findings. Publications must not include anything that could identify a Donor.</p>,
        },
        {
          id: "fees",
          title: "Fees and Donor share",
          body: <p>Partners pay a fee per analysis run. Half of each fee is shared with the Donors whose data was included.</p>,
        },
        {
          id: "audit",
          title: "Audit rights",
          body: <p>Every run, export, and blocked download is recorded. TrialCave may review a partner&apos;s use of results at any time.</p>,
        },
        {
          id: "termination",
          title: "Termination",
          body: <p>TrialCave may suspend or end access immediately if these rules are broken.</p>,
        },
      ]}
    />
  );
}
