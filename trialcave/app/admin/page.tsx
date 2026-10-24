import { getSessionUser, requireRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// DECISION: Phase 2 placeholder. Admin tabs (clinics, projects, trials, audit,
// demo reset) are built in Phase 10.
export default async function AdminHome() {
  await requireRole("admin");
  const user = await getSessionUser();

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">TrialCave Admin</h1>
        <Card className="mt-6 max-w-md">
          <CardHeader>
            <CardTitle>Signed in as admin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Clinic verification, project approvals, trial sync, audit log, and demo
            reset appear here.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
