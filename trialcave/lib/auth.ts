import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_HOME, type Role, type SessionUser } from "@/lib/types";

/**
 * Returns the current signed-in user with their role, or null if signed out.
 * Role comes from public.profiles. Uses getUser() (not getSession) so the token
 * is verified against Supabase (B7.6).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    userId: user.id,
    role: profile.role as Role,
    email: profile.email ?? user.email ?? "",
  };
}

/**
 * Requires a specific role. Redirects signed-out users to login and
 * wrong-role users to their own home (B6.3).
 */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}

export interface Patient {
  id: string;
  userId: string;
  displayName: string;
}

/**
 * Loads the current patient's row. Redirects to onboarding if the user has a
 * patient role but no patients row yet (B6.3).
 */
export async function getMyPatient(): Promise<Patient> {
  const user = await requireRole("patient");
  const admin = createAdminClient();
  const { data } = await admin
    .from("patients")
    .select("id, user_id, display_name")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (!data) redirect("/app/onboarding");

  return {
    id: data.id,
    userId: data.user_id,
    displayName: data.display_name,
  };
}

export interface Clinic {
  id: string;
  ownerUserId: string;
  name: string;
  verified: boolean;
}

export async function getMyClinic(): Promise<Clinic> {
  const user = await requireRole("clinic");
  const admin = createAdminClient();
  const { data } = await admin
    .from("clinics")
    .select("id, owner_user_id, name, verified")
    .eq("owner_user_id", user.userId)
    .maybeSingle();

  if (!data) {
    throw new Error("No clinic is associated with this account.");
  }
  return {
    id: data.id,
    ownerUserId: data.owner_user_id,
    name: data.name,
    verified: data.verified,
  };
}

export interface ResearchPartner {
  id: string;
  userId: string;
  orgName: string;
  verified: boolean;
}

export async function getMyResearchPartner(): Promise<ResearchPartner> {
  const user = await requireRole("researcher");
  const admin = createAdminClient();
  const { data } = await admin
    .from("research_partners")
    .select("id, user_id, org_name, verified")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (!data) {
    throw new Error("No research partner is associated with this account.");
  }
  return {
    id: data.id,
    userId: data.user_id,
    orgName: data.org_name,
    verified: data.verified,
  };
}

export async function assertClinicOwnsTrial(
  clinicId: string,
  trialId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trials")
    .select("id")
    .eq("id", trialId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) throw new Error("Not authorized for this study.");
}

export async function assertClinicOwnsInvitation(
  clinicId: string,
  invitationId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitations")
    .select("id")
    .eq("id", invitationId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) throw new Error("Not authorized for this invitation.");
}

export async function assertClinicOwnsApplication(
  clinicId: string,
  applicationId: string,
): Promise<void> {
  const admin = createAdminClient();
  // An application belongs to a clinic if its trial belongs to the clinic.
  const { data } = await admin
    .from("applications")
    .select("id, trials!inner(clinic_id)")
    .eq("id", applicationId)
    .eq("trials.clinic_id", clinicId)
    .maybeSingle();
  if (!data) throw new Error("Not authorized for this application.");
}

export interface ResearchProject {
  id: string;
  partnerId: string;
  title: string;
  status: string;
}

export async function assertApprovedProjectOwner(
  partnerId: string,
  projectId: string,
): Promise<ResearchProject> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("research_projects")
    .select("id, partner_id, title, status")
    .eq("id", projectId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (!data) throw new Error("Not authorized for this project.");
  if (data.status !== "approved") {
    throw new Error("This project is not approved yet.");
  }
  return {
    id: data.id,
    partnerId: data.partner_id,
    title: data.title,
    status: data.status,
  };
}
