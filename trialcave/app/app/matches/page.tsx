import { PatientNav } from "@/components/patient-nav";
import { MatchCard } from "@/components/match-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadMatches } from "@/lib/patient";
import type { MatchStatus } from "@/lib/matching/types";

export const dynamic = "force-dynamic";

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

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">My matches</h1>
        <p className="mt-1 text-muted-foreground">
          {matches.length} recruiting trials checked against your profile.
        </p>

        <Tabs defaultValue="strong" className="mt-6">
          <TabsList>
            {TAB_STATUS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({byStatus(t.status).length})
              </TabsTrigger>
            ))}
          </TabsList>
          {TAB_STATUS.map((t) => {
            const rows = byStatus(t.status);
            return (
              <TabsContent key={t.value} value={t.value}>
                {rows.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
                    No trials in this group.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {rows.map((m) => <MatchCard key={m.trialId} match={m} />)}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </main>
  );
}
