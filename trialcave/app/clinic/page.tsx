import { getMyClinic, getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// DECISION: Phase 2 placeholder. The clinic studies dashboard is built in Phase 7.
export default async function ClinicHome() {
  const user = await getSessionUser();
  const clinic = await getMyClinic();

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">{clinic.name}</h1>
        {!clinic.verified ? (
          <p className="mt-2 rounded-md bg-tc-secondary-soft px-3 py-2 text-sm text-foreground">
            Your clinic is pending verification. You can create studies, but
            invitations are disabled until TrialCave verifies your clinic.
          </p>
        ) : null}
        <Card className="mt-6 max-w-md">
          <CardHeader>
            <CardTitle>Signed in as a clinic</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your studies, anonymous match counts, and invitations appear here.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
