import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { MatchCard } from "@/components/match-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadMatches } from "@/lib/patient";
import type { MatchStatus } from "@/lib/matching/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My matches" };

const TAB_STATUS: { value: string; label: string; status: MatchStatus }[] = [
  { value: "strong", label: "Strong", status: "strong" },
  { value: "possible", label: "Possible", status: "possible" },
  { value: "needs_info", label: "Needs more info", status: "needs_info" },
  { value: "ineligible", label: "Not eligible", status: "ineligible" },
];

export default async function MatchesPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const matches = await loadMatches(patient.id);

  const byStatus = (s: MatchStatus) => matches.filter((m) => m.status === s);
  // Open the first group that has trials in it.
  const defaultTab = TAB_STATUS.find((t) => byStatus(t.status).length > 0)?.value ?? "strong";

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <PageHero title="My matches" lede={`${matches.length} recruiting trials checked against your profile.`}>
        <div className="flex flex-wrap gap-2">
          {TAB_STATUS.map((t) => (
            <span key={t.value} className="inline-flex items-center gap-2 rounded-full bg-tc-night-2 px-4 py-1.5 text-[0.95rem] font-bold text-tc-mint">
              {t.label} <span className="text-white">{byStatus(t.status).length}</span>
            </span>
          ))}
        </div>
      </PageHero>
      <PageBody width="wide">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="h-auto flex-wrap">
            {TAB_STATUS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({byStatus(t.status).length})
              </TabsTrigger>
            ))}
          </TabsList>
          {TAB_STATUS.map((t) => {
            const rows = byStatus(t.status);
            return (
              <TabsContent key={t.value} value={t.value} className="mt-6">
                {rows.length === 0 ? (
                  <Card>
                    <CardContent className="pt-8 text-center text-[1.05rem] text-tc-ink-2 sm:pt-8">
                      No trials in this group.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-2">
                    {rows.map((m) => <MatchCard key={m.trialId} match={m} />)}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </PageBody>
    </main>
  );
}
