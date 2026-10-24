import { Card, CardContent } from "@/components/ui/card";
import type { ContactReport } from "@/lib/outreach/report";

const ICON: Record<string, string> = { pass: "✅", fail: "❌", unknown: "❓", na: "➖" };

export function ContactReportView({ report }: { report: ContactReport }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">{report.displayName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {report.contactMethod ? report.contactMethod : "No contact method shared"}
          {report.town ? ` · ${report.town}` : ""}
          {report.age != null ? ` · ${report.age}` : ""}
          {report.sex ? ` · ${report.sex}` : ""}
        </p>

        <h3 className="mt-4 text-sm font-semibold">Pre-screen report</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {report.criteria.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>{ICON[c.icon]}</span>
              <span>
                {c.plainText} — <span className="text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">
          Final eligibility must be confirmed by your study team.
        </p>
      </CardContent>
    </Card>
  );
}
