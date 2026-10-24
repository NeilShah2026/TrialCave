import Link from "next/link";

import { PublicHeader } from "@/components/public-header";
import { Card, CardContent } from "@/components/ui/card";
import { LEGAL_DOCS } from "@/components/legal-layout";

export const metadata = { title: "Legal" };

const BLURBS: Record<string, string> = {
  "/legal/privacy": "What we collect, how it's used, and your rights.",
  "/legal/terms": "The rules for using TrialCave.",
  "/legal/donor-agreement": "How donating data, the Enclave, and paychecks work.",
  "/legal/clinic-agreement": "What research clinics agree to.",
  "/legal/research-partner-agreement": "What research partners agree to.",
};

export default function LegalIndexPage() {
  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[800px] px-4 py-10">
        <h1 className="text-3xl font-semibold">Legal</h1>
        <p className="mt-2 text-muted-foreground">Plain-language demo versions. Not reviewed by a lawyer.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.href} href={d.href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="pt-6">
                  <h2 className="font-semibold">{d.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{BLURBS[d.href]}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
