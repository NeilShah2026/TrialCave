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
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">{report.displayName}</h2>
        {facts.length ? <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p> : null}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {report.contactMethod ? (
            <a href={`mailto:${report.contactMethod}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Mail className="size-4" aria-hidden /> {report.contactMethod}
            </a>
          ) : null}
          {report.phone ? (
            <a href={`tel:${report.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Phone className="size-4" aria-hidden /> {report.phone}
            </a>
          ) : null}
          {!report.contactMethod && !report.phone ? <span className="text-muted-foreground">No contact method shared</span> : null}
        </div>

        {report.conditions ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Condition summary</h3>
            <p className="text-sm text-muted-foreground">{report.conditions.length ? report.conditions.join(", ") : "None on file"}</p>
          </div>
        ) : null}

        <h3 className="mt-4 text-sm font-semibold">Pre-screen report</h3>
        {report.criteria.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No criteria checked.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {report.criteria.map((c, i) => (
              <li key={i} className="flex gap-2">
                <CriterionIcon status={c.icon} kind={c.kind} className="[&_svg]:size-4 mt-0.5" />
                <span>
                  {c.kind === "exclusion" ? "Exclusion: " : ""}
                  {c.plainText} — <span className="text-muted-foreground">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Only the fields this person chose to share are shown. Final eligibility must be confirmed
          by your study team.
        </p>
      </CardContent>
    </Card>
  );
}
