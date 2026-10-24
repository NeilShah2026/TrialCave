import Link from "next/link";
import { format } from "date-fns";
import { FileText, Camera } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE } from "@/lib/env";
import { UploadPanel } from "./upload-panel";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; variant: "muted" | "warning" | "success" | "danger" }> = {
  processing: { label: "Processing", variant: "muted" },
  needs_review: { label: "Needs review", variant: "warning" },
  reviewed: { label: "Reviewed", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  rejected: { label: "Rejected", variant: "muted" },
};

export default async function RecordsPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: docs } = await admin
    .from("source_documents")
    .select("id, file_name, origin, facility_name, document_date, status, created_at")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Your records</h1>
        <p className="mt-1 text-muted-foreground">
          Build your health profile from records you already have.
        </p>

        <div className="mt-6">
          <UploadPanel demoMode={DEMO_MODE} />
        </div>

        <Card className="mt-4">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <h2 className="text-lg font-semibold">Prefer to type it in?</h2>
              <p className="text-sm text-muted-foreground">
                Enter lab results or answer a few yes/no health questions by hand.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/app/profile">Enter by hand</Link>
            </Button>
          </CardContent>
        </Card>

        <h2 className="mt-8 text-lg font-semibold">Documents</h2>
        {!docs || docs.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No documents yet. Take photos of your paperwork or upload a file above.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {docs.map((d) => {
              const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.processing;
              return (
                <li key={d.id}>
                  <Link href={`/app/records/${d.id}`} className="block">
                    <Card className="transition-colors hover:border-primary">
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                          {d.origin === "upload" ? (
                            <FileText className="size-5 text-muted-foreground" aria-hidden />
                          ) : (
                            <Camera className="size-5 text-muted-foreground" aria-hidden />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {d.facility_name ?? d.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {d.document_date ? format(new Date(d.document_date), "MMM d, yyyy") : format(new Date(d.created_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
