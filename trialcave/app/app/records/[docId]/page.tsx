import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVocabField } from "@/lib/matching/vocabulary";
import { ReviewClient, type ReviewFact } from "./review-client";

export const dynamic = "force-dynamic";

function formatPrior(valueNum: number | null, valueBool: boolean | null, unit: string | null, observedAt: string | null): string {
  let v: string;
  if (valueBool !== null) v = valueBool ? "Yes" : "No";
  else if (valueNum !== null) v = `${valueNum}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
  else v = "";
  if (observedAt) v += ` (${format(new Date(observedAt), "MMM yy")})`;
  return v;
}

export default async function ReviewPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("source_documents")
    .select("id, facility_name, document_date, status, origin")
    .eq("id", docId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!doc) notFound();

  const { data: pending } = await admin
    .from("patient_facts")
    .select("id, field, label, value_num, value_bool, value_text, unit, observed_at, source_quote")
    .eq("document_id", docId)
    .eq("patient_id", patient.id)
    .eq("status", "pending");

  // Current confirmed facts for "was X" prior values.
  const { data: current } = await admin
    .from("patient_current_facts")
    .select("field, value_num, value_bool, unit, observed_at")
    .eq("patient_id", patient.id);
  const currentMap = new Map((current ?? []).map((c) => [c.field, c]));

  const facts: ReviewFact[] = (pending ?? []).map((f) => {
    const vocab = f.field ? getVocabField(f.field) : undefined;
    const cur = f.field ? currentMap.get(f.field) : undefined;
    let comparison = "new";
    let priorValue: string | null = null;
    if (!f.field) comparison = "display_only";
    else if (cur) {
      priorValue = formatPrior(cur.value_num, cur.value_bool, cur.unit, cur.observed_at);
      const sameNum = f.value_num !== null && cur.value_num !== null && f.value_num === cur.value_num;
      const sameBool = f.value_bool !== null && cur.value_bool !== null && f.value_bool === cur.value_bool;
      comparison = sameNum || sameBool ? "same" : "update";
    }
    return {
      id: f.id,
      field: f.field,
      label: f.label,
      valueNum: f.value_num,
      valueBool: f.value_bool,
      valueText: f.value_text,
      unit: f.unit,
      sourceQuote: f.source_quote ?? "",
      comparison,
      priorValue,
      sensitive: vocab?.sensitive ?? false,
      warning: null,
    };
  });

  const facility = doc.facility_name ?? "Your document";
  const dateLabel = doc.document_date
    ? `${doc.origin === "upload" ? "Uploaded" : "Added"} · ${format(new Date(doc.document_date), "MMM d, yyyy")}`
    : "Recently added";

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/app/records" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Records
        </Link>

        {doc.status === "failed" ? (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t read this document. Try a clearer photo, or enter your
                results by hand from your profile.
              </p>
            </CardContent>
          </Card>
        ) : facts.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                {doc.status === "reviewed"
                  ? "You've already reviewed this document."
                  : "No items to review."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4">
            <ReviewClient documentId={docId} facility={facility} dateLabel={dateLabel} facts={facts} />
          </div>
        )}
      </div>
    </main>
  );
}
