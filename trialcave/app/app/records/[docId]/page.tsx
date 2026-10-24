import { notFound } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVocabField } from "@/lib/matching/vocabulary";
import { ReviewClient, type ReviewFact } from "./review-client";
import { DocumentActions } from "../document-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review a record" };

function formatPrior(valueNum: number | null, valueBool: boolean | null, unit: string | null, observedAt: string | null): string {
  let v: string;
  if (valueBool !== null) v = valueBool ? "Yes" : "No";
  else if (valueNum !== null) v = `${valueNum}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
  else v = "";
  if (observedAt) v += ` (${format(parseISO(observedAt), "MMM yyyy")})`;
  return v;
}

export default async function ReviewPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("source_documents")
    .select("id, facility_name, document_date, status, origin, storage_path, file_name, created_at")
    .eq("id", docId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!doc) notFound();

  const { data: docFacts } = await admin
    .from("patient_facts")
    .select("id, field, label, value_num, value_bool, value_text, unit, observed_at, source_quote, status")
    .eq("document_id", docId)
    .eq("patient_id", patient.id);
  const pending = (docFacts ?? []).filter((f) => f.status === "pending");
  const confirmedCount = (docFacts ?? []).filter((f) => f.status === "confirmed").length;

  // Current confirmed facts for "your profile had X" prior values.
  const { data: current } = await admin
    .from("patient_current_facts")
    .select("field, value_num, value_bool, unit, observed_at")
    .eq("patient_id", patient.id);
  const currentMap = new Map((current ?? []).map((c) => [c.field, c]));

  const facts: ReviewFact[] = pending.map((f) => {
    const vocab = f.field ? getVocabField(f.field) : undefined;
    const cur = f.field ? currentMap.get(f.field) : undefined;
    let comparison = "new";
    let priorValue: string | null = null;
    if (!f.field) comparison = "display_only";
    else if (cur) {
      priorValue = formatPrior(cur.value_num, cur.value_bool, cur.unit, cur.observed_at);
      const sameNum = f.value_num !== null && cur.value_num !== null && Number(f.value_num) === Number(cur.value_num);
      const sameBool = f.value_bool !== null && cur.value_bool !== null && f.value_bool === cur.value_bool;
      const older = f.observed_at && cur.observed_at ? f.observed_at < cur.observed_at : false;
      comparison = sameNum || sameBool ? "same" : older ? "older" : "update";
    }
    return {
      id: f.id,
      field: f.field,
      label: f.label,
      valueNum: f.value_num != null ? Number(f.value_num) : null,
      valueBool: f.value_bool,
      valueText: f.value_text,
      unit: f.unit,
      sourceQuote: f.source_quote ?? "",
      comparison,
      priorValue,
      sensitive: vocab?.sensitive ?? false,
      warning: f.field && f.value_num == null && f.value_bool == null && !f.value_text ? "We couldn't read a value for this item." : null,
    };
  });

  const facility = doc.facility_name ?? doc.file_name ?? "Your document";
  const dateLabel = doc.document_date
    ? `Visit or report date · ${format(parseISO(doc.document_date), "MMM d, yyyy")}`
    : `Added ${format(new Date(doc.created_at), "MMM d, yyyy")}`;

  const heroTitle = doc.status === "failed" ? "We couldn't read this document" : facility;

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <PageHero
        tone="mist"
        width="narrow"
        back={{ href: "/app/records", label: "Records" }}
        kicker={doc.status === "failed" ? facility : dateLabel}
        title={heroTitle}
        actions={<DocumentActions documentId={docId} confirmedCount={confirmedCount} hasFile={Boolean(doc.storage_path)} afterDelete="/app/records" />}
      />
      <PageBody width="narrow">
        {doc.status === "processing" ? (
          <div className="flex items-center gap-3 rounded-2xl bg-tc-primary-soft px-5 py-4 text-[1.05rem] font-semibold text-tc-primary-ink" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            We&apos;re still reading this document. Refresh in a moment.
          </div>
        ) : doc.status === "failed" ? (
          <Card>
            <CardContent className="pt-6 sm:pt-7">
              <p className="rounded-2xl bg-tc-danger-soft px-5 py-4 text-[1.05rem] font-semibold text-tc-danger-ink">
                Try a clearer photo or a PDF, or enter your results by hand.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild><Link href="/app/records">Try another upload</Link></Button>
                <Button asChild variant="outline"><Link href="/app/profile?tab=labs">Enter results by hand</Link></Button>
              </div>
            </CardContent>
          </Card>
        ) : facts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 sm:pt-7">
              <p className="text-[1.05rem] text-tc-ink-2">
                {doc.status === "reviewed"
                  ? `You've reviewed this document. ${confirmedCount} item${confirmedCount === 1 ? " is" : "s are"} in your profile.`
                  : "We didn't find any health items in this document."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="outline"><Link href="/app/profile">See your profile</Link></Button>
                <Button asChild variant="outline"><Link href="/app/matches">See your matches</Link></Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ReviewClient documentId={docId} facility={facility} dateLabel={dateLabel} facts={facts} />
        )}
      </PageBody>
    </main>
  );
}
