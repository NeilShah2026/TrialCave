import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Data Donor Agreement" };

export default function DonorAgreementPage() {
  return (
    <LegalLayout
      title="Data Donor Agreement"
      current="/legal/donor-agreement"
      summary="Like donating blood plasma: you contribute de-identified data to research, it stays inside the Enclave, and you collect a paycheck when your donation powers a study. It's voluntary, you choose exactly what to donate, and you can withdraw anytime."
      sections={[
        {
          id: "voluntary",
          title: "Donating is voluntary",
          body: <p>Becoming a Data Donor is optional. Saying no, or stopping later, never affects trial matching or applying.</p>,
        },
        {
          id: "what",
          title: "What you donate",
          body: (
            <>
              <p>You choose each data type and each kind of research separately. Everything is off until you turn it on.</p>
              <ul>
                <li><strong>Wearables:</strong> daily step, sleep, heart-rate, and glucose summaries from devices you connect.</li>
                <li><strong>Lab results:</strong> values from lab reports you upload.</li>
                <li><strong>Scans:</strong> scans you already have and choose to donate.</li>
                <li><strong>Health history:</strong> diagnoses and medications from your confirmed records.</li>
              </ul>
              <p>Research types: academic, drug companies, medical AI, and device makers.</p>
            </>
          ),
        },
        {
          id: "enclave",
          title: "Enclave rules",
          body: (
            <ul>
              <li>Your donated data is de-identified and stays inside the Enclave.</li>
              <li>Researchers can only run approved, predefined analyses and only receive group results.</li>
              <li>Any group smaller than 10 people is hidden.</li>
              <li>No one, including research partners, can download individual records.</li>
              <li>Pregnancy and breastfeeding answers are never used in the Enclave.</li>
            </ul>
          ),
        },
        {
          id: "paycheck",
          title: "How Donor paychecks work",
          body: (
            <>
              <ul>
                <li><strong>On donation:</strong> a fixed amount for some contributions, such as connecting a device for 30 days.</li>
                <li><strong>When your donation powers research:</strong> half of each analysis fee is split evenly among the Donors included.</li>
              </ul>
              <p>
                Paychecks are thank-you payments, not wages, and may be taxable. Only data with
                provenance (connected devices, documents on file) earns money. Values you type in or
                yes/no answers are used for matching only. Paychecks are for donating data, never for
                joining a trial. In this demo, all amounts are simulated.
              </p>
            </>
          ),
        },
        {
          id: "withdraw",
          title: "Withdrawing",
          body: <p>You can withdraw anytime from the Donor page or Privacy controls. Your data won&apos;t be used in any new analysis. Group results already produced can&apos;t be recalled. Paychecks you&apos;ve earned are kept.</p>,
        },
        {
          id: "risk",
          title: "Residual risk, in plain words",
          body: <p>De-identified data can never be made perfectly impossible to link back to a person. We reduce that risk by keeping data inside the Enclave, hiding small groups, and allowing only group results out. We&apos;ll tell you if we learn of a problem.</p>,
        },
      ]}
    />
  );
}
