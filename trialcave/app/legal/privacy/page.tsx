import Link from "next/link";

import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Privacy Notice" };

const RETENTION = [
  ["Uploaded documents and files", "Until you delete them or your account", "You can delete any document anytime"],
  ["Confirmed health facts, device data, scans", "Until you delete them or your account", ""],
  ["Match results and change history", "Recomputed as your profile changes; deleted with your health data", ""],
  ["Consent records", "Life of your account plus 3 years", "Proof of what you agreed to"],
  ["Donor payment records", "As tax rules require (generally 3–7 years)", "No bank or tax numbers are stored"],
  ["Audit log", "3 years", "Ids and counts only, never your health details"],
  ["Translation cache", "Indefinitely", "Trial text only, no personal data"],
];

export default function PrivacyNoticePage() {
  return (
    <LegalLayout
      title="Privacy Notice"
      current="/legal/privacy"
      summary="Your health data lives in your TrialCave vault. You decide who sees what, clinics only see fields you approve, research partners only ever get group results, and we never sell personal data. You can download, correct, or delete your data, or withdraw from research, at any time."
      sections={[
        {
          id: "collect",
          title: "What we collect",
          body: (
            <>
              <ul>
                <li><strong>Account details:</strong> your name, email, and date of birth (to confirm you&apos;re 18 or older).</li>
                <li><strong>Health facts you add:</strong> diagnoses, medications, lab values, and dates from records you upload, values you type, and yes/no answers.</li>
                <li><strong>Connected devices (optional):</strong> daily summaries such as steps, sleep, heart rate, and glucose time-in-range.</li>
                <li><strong>Preferences:</strong> your town, travel radius, language, invitation settings, and research choices.</li>
                <li><strong>Consent records:</strong> what you agreed to, which version, and when.</li>
              </ul>
            </>
          ),
        },
        {
          id: "not-collect",
          title: "What we don't collect",
          body: (
            <ul>
              <li>Precise location. We store your town only, never GPS or your address, and we never ask your browser for location.</li>
              <li>Genetic test results. Our record reader skips them, and uploads can&apos;t be labeled genetic.</li>
              <li>Social Security, driver&apos;s license, bank, or card numbers.</li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use your data",
          body: (
            <ul>
              <li><strong>Matching:</strong> to check your profile against recruiting trials, criterion by criterion, and show what changed.</li>
              <li><strong>Reading your records:</strong> uploaded files are read by an AI service to suggest facts. Nothing is used until you confirm it.</li>
              <li><strong>Translations:</strong> trial text (never your health data) may be machine-translated into your language.</li>
              <li><strong>Clinic invitations:</strong> only if you turn them on. Clinics see a count, never who you are.</li>
              <li><strong>Data Donor research:</strong> only if you opt in, and only for the data types and research types you choose.</li>
            </ul>
          ),
        },
        {
          id: "no-sale",
          title: "No sale of personal data",
          body: (
            <p>
              We never sell personal data, and no one downloads your records. Research partners pay
              for analyses run inside the Enclave, and they only receive group results. Half of each
              analysis fee goes to the Data Donors whose data was included.
            </p>
          ),
        },
        {
          id: "clinics",
          title: "How sharing with clinics works",
          body: (
            <>
              <p>
                A clinic can send you an invitation only if you allow invitations, you meet their
                study&apos;s criteria, and they&apos;re verified. Before you approve, the clinic only sees
                a count of people who match. Invitations stay anonymous until you approve.
              </p>
              <p>
                When you approve an invitation or apply, you pick exactly which fields to share. You
                can stop sharing anytime, and the clinic loses access right away. Declines are never
                identified.
              </p>
            </>
          ),
        },
        {
          id: "enclave",
          title: "The Enclave (Data Donors only)",
          body: (
            <ul>
              <li>Donated data is de-identified and stays inside the TrialCave Enclave.</li>
              <li>Researchers can only run approved, predefined analyses. They never see individual records.</li>
              <li>Any group with fewer than 10 people is hidden from results.</li>
              <li>Only aggregate results can be exported. There is no way to download raw records.</li>
            </ul>
          ),
        },
        {
          id: "trackers",
          title: "No third-party trackers",
          body: <p>No analytics pixels, ad SDKs, session replay, or chat widgets on any page. Our server logs never contain your health facts or document contents.</p>,
        },
        {
          id: "retention",
          title: "How long we keep data",
          body: (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">Retention schedule</caption>
                <thead>
                  <tr className="border-b border-border text-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Data</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Kept until</th>
                    <th scope="col" className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {RETENTION.map(([d, k, n]) => (
                    <tr key={d} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3">{d}</td>
                      <td className="py-2 pr-3">{k}</td>
                      <td className="py-2">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "rights",
          title: "Your rights and how to use them",
          body: (
            <>
              <p>From <Link href="/app/privacy" className="text-primary hover:underline">Privacy controls</Link> in your account you can:</p>
              <ul>
                <li><strong>Download</strong> a full copy of your data as a file.</li>
                <li><strong>Correct</strong> any item from your health profile. Corrections are recorded.</li>
                <li><strong>Withdraw from research.</strong> Your data won&apos;t be used in any new analysis. Group results already produced can&apos;t be recalled.</li>
                <li><strong>Delete</strong> your health data or your whole account. We keep payment and consent records as required and tell you exactly what stays.</li>
              </ul>
            </>
          ),
        },
        {
          id: "security",
          title: "Security and breach notice",
          body: (
            <p>
              We follow strict privacy and security practices: encryption in transit and at rest,
              row-level access rules, and an audit trail for every cross-party access. If a breach
              affects your data, we&apos;ll notify you and the authorities as Massachusetts law
              (M.G.L. c. 93H) and the FTC Health Breach Notification Rule require.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this notice",
          body: <p>If we change how we use your data, we&apos;ll update the version number above and ask you to agree again before the change applies to you.</p>,
        },
      ]}
    />
  );
}
