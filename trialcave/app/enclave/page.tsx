import { getMyResearchPartner, getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// DECISION: Phase 2 placeholder. The Enclave workspace is built in Phase 8.
export default async function EnclaveHome() {
  const user = await getSessionUser();
  const partner = await getMyResearchPartner();

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">{partner.orgName}</h1>
        <p className="mt-1 text-muted-foreground">
          You are working inside the TrialCave Enclave. Individual records never
          leave this environment.
        </p>
        <Card className="mt-6 max-w-md">
          <CardHeader>
            <CardTitle>Signed in as a research partner</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your approved projects and aggregate analyses appear here.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
