import Link from "next/link";
import { format, parseISO } from "date-fns";
import { FileText, Mail, FlaskConical } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE } from "@/lib/env";
import { UploadPanel } from "./upload-panel";
import { DocumentActions } from "./document-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Records" };

const STATUS_BADGE: Record<string, { label: string; variant: "muted" | "warning" | "success" | "danger" }> = {
  processing: { label: "Processing", variant: "muted" },
  needs_review: { label: "Needs review", variant: "warning" },
  reviewed: { label: "Reviewed", variant: "success" },
  failed: { label: "Couldn't read", variant: "danger" },
  rejected: { label: "Rejected", variant: "muted" },
};

export default async function RecordsPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: docs, error } = await admin
    .from("source_documents")
    .select("id, file_name, origin, facility_name, document_date, status, created_at, storage_path")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });

  const docIds = (docs ?? []).map((d) => d.id);
  const { data: factRows } = docIds.length
    ? await admin.from("patient_facts").select("document_id, status").in("document_id", docIds)
    : { data: [] as { document_id: string; status: string }[] };
  const counts = new Map<string, { confirmed: number; pending: number }>();
  for (const f of factRows ?? []) {
    const c = counts.get(f.document_id) ?? { confirmed: 0, pending: 0 };
    if (f.status === "confirmed") c.confirmed++;
    if (f.status === "pending") c.pending++;
    counts.set(f.document_id, c);
  }

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <PageHero
        title="Your records"
        lede="Build your health profile from records you already have."
        width="narrow"
      />
      <PageBody width="narrow">
        <div className="space-y-6">
          <UploadPanel demoMode={DEMO_MODE} />

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6 sm:pt-7">
              <div>
                <h2 className="text-[1.15rem] font-bold">Prefer to type it in?</h2>
                <p className="text-[1rem] text-tc-ink-2">
                  Enter lab results or answer a few yes/no health questions by hand.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/app/profile?tab=labs">Enter lab results</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/app/profile?tab=history">Health history</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <h2 className="mt-10 text-[1.45rem] font-extrabold tracking-tight">Documents</h2>
        {error ? (
          <div role="alert" className="mt-4 rounded-2xl bg-tc-danger-soft px-5 py-4 text-[1rem] font-semibold text-tc-danger-ink">
            We couldn&apos;t load your documents. Refresh to try again.
          </div>
        ) : !docs || docs.length === 0 ? (
          <div className="mt-4 rounded-[24px] border-2 border-dashed border-tc-border bg-white p-8 text-center text-[1.05rem] text-tc-ink-2">
            No documents yet. Take photos of your paperwork or upload a file above.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {docs.map((d) => {
              const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.processing;
              const c = counts.get(d.id) ?? { confirmed: 0, pending: 0 };
              const Icon = d.origin === "email" ? Mail : d.origin === "demo" ? FlaskConical : FileText;
              return (
                <li key={d.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                      <Link
                        href={`/app/records/${d.id}`}
                        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tc-mist text-tc-primary-ink">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[1.1rem] font-bold text-tc-ink group-hover:underline">{d.facility_name ?? d.file_name}</p>
                          <p className="text-[0.95rem] text-tc-muted">
                            {d.document_date
                              ? `Visit ${format(parseISO(d.document_date), "MMM d, yyyy")}`
                              : `Added ${format(new Date(d.created_at), "MMM d, yyyy")}`}
                            {c.confirmed > 0 ? ` · ${c.confirmed} item${c.confirmed === 1 ? "" : "s"} in your profile` : ""}
                            {c.pending > 0 ? ` · ${c.pending} to review` : ""}
                          </p>
                        </div>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {d.status === "needs_review" ? (
                          <Button asChild size="sm"><Link href={`/app/records/${d.id}`}>Review</Link></Button>
                        ) : null}
                        <DocumentActions documentId={d.id} confirmedCount={c.confirmed} hasFile={Boolean(d.storage_path)} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </main>
  );
}
