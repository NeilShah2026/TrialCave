import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/privacy/export — returns a JSON file of all the patient's own data
 * (B14.3). Patient role only.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "patient") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: patient } = await admin.from("patients").select("*").eq("user_id", user.userId).maybeSingle();
  if (!patient) return NextResponse.json({ error: "No profile." }, { status: 404 });

  const pid = patient.id;
  const tables = [
    "source_documents",
    "patient_facts",
    "wearable_daily",
    "connected_sources",
    "scans",
    "research_consents",
    "consent_events",
    "contact_preferences",
    "match_results",
    "applications",
    "invitations",
    "donor_earnings",
  ];
  const payload: Record<string, unknown> = { profile: patient, exportedAt: new Date().toISOString() };
  for (const t of tables) {
    const { data } = await admin.from(t).select("*").eq("patient_id", pid);
    payload[t] = data ?? [];
  }

  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "data.exported", targetType: "patient", targetId: pid });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="trialcave-my-data.json"`,
    },
  });
}
