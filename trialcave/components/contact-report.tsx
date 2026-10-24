import { Mail, Phone } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CriterionIcon } from "@/components/criterion-icon";
import type { ContactReport } from "@/lib/outreach/report";

export function ContactReportView({ report }: { report: ContactReport }) {
  const facts = [
    report.age != null ? `Age ${report.age}` : null,
    report.sex ? (report.sex === "female" ? "Female" : report.sex === "male" ? "Male" : report.sex) : null,
    report.town,
  ].filter(Boolean);

  return (
    <Card>
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div>
          <h2 className="text-[1.45rem] font-extrabold tracking-tight">{report.displayName}</h2>
          {facts.length ? <p className="mt-1 text-[1.05rem] text-tc-ink-2">{facts.join(" · ")}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {report.contactMethod ? (
              <a
                href={`mailto:${report.contactMethod}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-tc-primary-soft px-4 font-bold text-tc-primary-ink hover:underline"
              >
                <Mail className="size-5" aria-hidden /> {report.contactMethod}
              </a>
            ) : null}
            {report.phone ? (
              <a
                href={`tel:${report.phone}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-tc-primary-soft px-4 font-bold text-tc-primary-ink hover:underline"
              >
                <Phone className="size-5" aria-hidden /> {report.phone}
              </a>
            ) : null}
            {!report.contactMethod && !report.phone ? (
              <span className="rounded-2xl bg-tc-mist px-4 py-3 text-tc-ink-2">No contact method shared</span>
            ) : null}
          </div>
        </div>

        {report.conditions ? (
          <div className="rounded-2xl bg-tc-mist p-5">
            <h3 className="text-[1.15rem] font-bold">Condition summary</h3>
            <p className="mt-1 text-[1.05rem] text-tc-ink-2">{report.conditions.length ? report.conditions.join(", ") : "None on file"}</p>
          </div>
        ) : null}

        <div>
          <h3 className="text-[1.15rem] font-bold">Pre-screen report</h3>
          {report.criteria.length === 0 ? (
            <p className="mt-2 text-tc-ink-2">No criteria checked.</p>
          ) : (
            <ul className="mt-3 divide-y divide-tc-border">
              {report.criteria.map((c, i) => (
                <li key={i} className="flex gap-3 py-3 text-[1.05rem]">
                  <CriterionIcon status={c.icon} kind={c.kind} className="mt-0.5 [&_svg]:size-5" />
                  <span className="text-tc-ink">
                    {c.kind === "exclusion" ? "Exclusion: " : ""}
                    {c.plainText} — <span className="text-tc-ink-2">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="rounded-2xl bg-tc-primary-soft px-5 py-4 text-[0.95rem] font-semibold text-tc-primary-ink">
          Only the fields this person chose to share are shown. Final eligibility must be confirmed
          by your study team.
        </p>
      </CardContent>
    </Card>
  );
}
