import { getMyPatient, getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// DECISION: Phase 2 placeholder. The real patient dashboard (what-changed banner,
// matches, missing info, records, donor card) is built in Phase 6.
export default async function PatientHome() {
  const user = await getSessionUser();
  const patient = await getMyPatient();

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Hi {patient.displayName.split(" ")[0]}</h1>
        <p className="mt-1 text-muted-foreground">
          Your vault is ready. The full dashboard arrives in a later build phase.
        </p>
        <Card className="mt-6 max-w-md">
          <CardHeader>
            <CardTitle>Signed in as a patient</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Matches, records, and your Data Donor paycheck will appear here.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
