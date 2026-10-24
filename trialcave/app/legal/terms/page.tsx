import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      current="/legal/terms"
      summary="TrialCave is a free tool for adults 18 and older to find clinical trials and pre-screen for them using their own records. It doesn't give medical advice, and the study team always makes the final eligibility decision."
      sections={[
        {
          id: "who",
          title: "Who can use TrialCave",
          body: <p>TrialCave is for adults 18 and older. Research clinics and research partners use separate accounts and agree to their own terms.</p>,
        },
        {
          id: "free",
          title: "Free for patients",
          body: <p>Finding trials, matching, and applying are always free. You don&apos;t need to be a Data Donor to use any of them.</p>,
        },
        {
          id: "not-advice",
          title: "Not medical advice",
          body: (
            <>
              <p>
                TrialCave shows how your records compare with each trial&apos;s published criteria.
                &quot;Strong match&quot; means pre-qualified, likely eligible. It is not a promise that
                you can join.
              </p>
              <p>The study team makes the final decision. Talk with your own doctor before making health decisions.</p>
            </>
          ),
        },
        {
          id: "accuracy",
          title: "Your information",
          body: (
            <ul>
              <li>Give accurate information and only add records that are about you.</li>
              <li>Check each item our record reader suggests. Nothing is used until you confirm it.</li>
              <li>You can correct or delete your information anytime.</li>
            </ul>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: (
            <ul>
              <li>Don&apos;t submit data that isn&apos;t yours or that you know is false.</li>
              <li>Don&apos;t try to access other people&apos;s data or get around our security.</li>
              <li>Don&apos;t use automated tools to scrape the site or overload it.</li>
            </ul>
          ),
        },
        {
          id: "donor",
          title: "Data Donor program",
          body: <p>Donating data is optional and covered by the separate Data Donor Agreement. Donor paychecks are thank-you payments, not wages, and don&apos;t create an employment relationship.</p>,
        },
        {
          id: "ending",
          title: "Closing your account",
          body: <p>You can delete your account anytime from Privacy controls. We may suspend accounts that break these terms.</p>,
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of the Commonwealth of Massachusetts.</p>,
        },
        {
          id: "contact",
          title: "Contact us",
          body: <p>Email support@trialcave.example (demo address) with any question about these terms.</p>,
        },
      ]}
    />
  );
}
