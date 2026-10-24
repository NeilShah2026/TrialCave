import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_VERSION } from "@/lib/env";
import { hashText, CONSENT_TEXT, type ConsentType } from "@/lib/consent";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { PERSONAS, type Persona } from "@/lib/demo/personas";
import { generateSyntheticPatients } from "@/lib/demo/generator";
import {
  DEMO_CLINICS,
  DEMO_STUDIES,
  DEFAULT_INVITE_MESSAGE,
} from "@/lib/demo/studies";
import { vocabLabel } from "@/lib/matching/vocabulary";
import { isoDateAgo, isoDaysAgo, birthDateForAge } from "@/lib/dates";
import { getTown } from "@/lib/geo/towns";

type Admin = ReturnType<typeof createAdminClient>;

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "TrialCave2026!";

// App tables cleared on each seed (NOT trials/trial_criteria for ctgov, NOT translations).
const APP_TABLES_TO_CLEAR = [
  "donor_earnings",
  "donor_contributions",
  "enclave_runs",
  "research_projects",
  "research_partners",
  "invitations",
  "applications",
  "match_changes",
  "match_results",
  "criterion_answers",
  "trial_criteria", // only clinic-study criteria; ctgov criteria handled separately
  "muted_clinics",
  "contact_preferences",
  "consent_events",
  "research_consents",
  "scans",
  "connected_sources",
  "wearable_daily",
  "patient_facts",
  "source_documents",
  "patients",
  "clinics",
];

export interface SeedResult {
  patients: number;
  clinics: number;
  studies: number;
  authUsers: number;
}

/**
 * Idempotent demo seed (B13.7). Running twice gives the same result.
 */
export async function seedDemo(): Promise<SeedResult> {
  const admin = createAdminClient();

  const authUserIds = await ensureAuthUsers(admin);
  await clearAppData(admin);

  const clinicIds = await insertClinics(admin, authUserIds);
  const studyCount = await insertDemoStudies(admin, clinicIds);

  let patientCount = 0;
  for (const persona of PERSONAS) {
    await insertPersona(admin, persona, authUserIds.get(persona.email)!);
    patientCount++;
  }
  patientCount += await insertSyntheticPatients(admin);

  // NOTE: match precompute (runMatchesForPatient / runMatchesForTrial) lands in
  // Phase 4. Until then, the seed leaves match_results empty; the Phase 4 script
  // (db:match) fills them in.

  return {
    patients: patientCount,
    clinics: clinicIds.size,
    studies: studyCount,
    authUsers: authUserIds.size,
  };
}

async function ensureAuthUsers(admin: Admin): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  // Load existing users (paginate).
  const existing = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
    page++;
  }

  for (const acct of DEMO_ACCOUNTS) {
    const email = acct.email.toLowerCase();
    let userId = existing.get(email);
    if (userId) {
      // Reset password so demo logins are predictable.
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acct.name },
      });
      if (error || !data.user) throw new Error(`createUser ${email} failed: ${error?.message}`);
      userId = data.user.id;
    }
    ids.set(acct.email, userId);

    // Upsert profile.
    const { error: pErr } = await admin.from("profiles").upsert(
      { id: userId, role: acct.role, full_name: acct.name, email: acct.email },
      { onConflict: "id" },
    );
    if (pErr) throw new Error(`profile upsert ${email} failed: ${pErr.message}`);
  }

  // Delete auth users not in the demo list (stray rehearsal sign-ups).
  const demoEmails = new Set(DEMO_ACCOUNTS.map((a) => a.email.toLowerCase()));
  for (const [email, id] of existing) {
    if (!demoEmails.has(email)) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  }

  return ids;
}

async function clearAppData(admin: Admin): Promise<void> {
  // Delete clinic-study criteria first (keep ctgov criteria).
  const { data: clinicTrials } = await admin
    .from("trials")
    .select("id")
    .eq("source", "clinic");
  const clinicTrialIds = (clinicTrials ?? []).map((t) => t.id);
  if (clinicTrialIds.length > 0) {
    await admin.from("trial_criteria").delete().in("trial_id", clinicTrialIds);
  }

  for (const table of APP_TABLES_TO_CLEAR) {
    if (table === "trial_criteria") continue; // handled above
    const { error } = await admin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // Some tables (contact_preferences, wearable_daily, etc.) have composite keys without `id`.
    if (error && /column .*id.* does not exist/i.test(error.message)) {
      await admin.from(table).delete().not("patient_id", "is", null);
    }
  }

  // Delete clinic-source trials (demo studies are recreated each seed).
  if (clinicTrialIds.length > 0) {
    await admin.from("trials").delete().in("id", clinicTrialIds);
  }

  // Clear storage buckets.
  for (const bucket of ["documents", "labs", "scans"]) {
    const { data: files } = await admin.storage.from(bucket).list();
    if (files && files.length > 0) {
      await admin.storage.from(bucket).remove(files.map((f) => f.name)).catch(() => {});
    }
  }
}

async function insertClinics(
  admin: Admin,
  authIds: Map<string, string>,
): Promise<Map<string, string>> {
  const clinicIds = new Map<string, string>();
  for (const c of DEMO_CLINICS) {
    const ownerId = authIds.get(c.email);
    if (!ownerId) continue;
    const { data, error } = await admin
      .from("clinics")
      .insert({
        owner_user_id: ownerId,
        name: c.name,
        town: c.town,
        lat: c.lat,
        lon: c.lon,
        verified: c.verified,
        irb_on_file: c.irbOnFile,
      })
      .select("id")
      .single();
    if (error) throw new Error(`clinic insert ${c.name} failed: ${error.message}`);
    clinicIds.set(c.email, data.id);
  }
  return clinicIds;
}

async function insertDemoStudies(
  admin: Admin,
  clinicIds: Map<string, string>,
): Promise<number> {
  let count = 0;
  for (const study of DEMO_STUDIES) {
    const clinicId = clinicIds.get(study.clinicEmail);
    const clinic = DEMO_CLINICS.find((c) => c.email === study.clinicEmail)!;
    if (!clinicId) continue;

    const inviteMessage = DEFAULT_INVITE_MESSAGE.replace("{study}", study.title).replace(
      "{clinic}",
      clinic.name,
    );
    const ownerId = (await admin.from("clinics").select("owner_user_id").eq("id", clinicId).single())
      .data?.owner_user_id;

    const { data: trial, error } = await admin
      .from("trials")
      .insert({
        source: "clinic",
        clinic_id: clinicId,
        title: study.title,
        plain_summary: study.plainSummary,
        what_is_involved: study.whatIsInvolved,
        logistics: study.logistics,
        conditions: [],
        condition_category: study.conditionCategory,
        phases: study.phases,
        overall_status: "RECRUITING",
        study_type: study.studyType,
        min_age_years: study.minAge,
        max_age_years: study.maxAge,
        sex: study.sex,
        parse_status: "parsed",
        study_status: "active",
        irb_protocol_number: study.irbProtocolNumber,
        invite_message: inviteMessage,
        invite_message_attested_by: ownerId,
        invite_message_attested_at: new Date().toISOString(),
        is_demo: true,
        locations: [
          { facility: clinic.name, city: clinic.town, state: "MA", lat: clinic.lat, lon: clinic.lon, status: "RECRUITING" },
        ],
      })
      .select("id")
      .single();
    if (error) throw new Error(`study insert ${study.title} failed: ${error.message}`);

    const criteriaRows = study.criteria.map((c, i) => ({
      trial_id: trial.id,
      kind: c.kind,
      original_text: c.plainText,
      plain_text: c.plainText,
      category: c.category,
      field: c.field,
      operator: c.operator,
      value_min: c.valueMin,
      value_max: c.valueMax,
      value_text: c.valueText,
      unit: c.unit,
      machine_checkable: c.field !== null && c.operator !== null,
      patient_question: c.question,
      sort_order: i,
    }));
    const { error: cErr } = await admin.from("trial_criteria").insert(criteriaRows);
    if (cErr) throw new Error(`criteria insert ${study.title} failed: ${cErr.message}`);
    count++;
  }
  return count;
}

async function insertPersona(admin: Admin, persona: Persona, userId: string): Promise<void> {
  const town = getTown(persona.town)!;
  const { data: patient, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      display_name: persona.displayName,
      date_of_birth: birthDateForAge(persona.ageYears),
      sex: persona.sex,
      town: persona.town,
      lat: town.lat,
      lon: town.lon,
      travel_radius_miles: persona.travelRadiusMiles,
      preferred_language: persona.preferredLanguage,
      is_donor: persona.isDonor,
      is_synthetic: false,
      inbox_token: persona.inboxToken,
      email_ingest_enabled: persona.emailIngestEnabled,
    })
    .select("id")
    .single();
  if (error) throw new Error(`persona insert ${persona.email} failed: ${error.message}`);
  const patientId = patient.id;

  // Facts
  const factRows = persona.facts.map((f) => ({
    patient_id: patientId,
    field: f.field,
    label: vocabLabel(f.field),
    value_num: typeof f.value === "number" ? f.value : null,
    value_bool: typeof f.value === "boolean" ? f.value : null,
    value_text: typeof f.value === "string" ? f.value : null,
    unit: f.unit ?? null,
    observed_at: isoDateAgo(f.ago),
    source: f.source,
    status: "confirmed",
  }));
  if (factRows.length) await admin.from("patient_facts").insert(factRows);

  // Connected sources
  if (persona.connectedSources.length) {
    await admin.from("connected_sources").insert(
      persona.connectedSources.map((s) => ({ patient_id: patientId, source: s, is_demo: true })),
    );
  }

  // Wearables
  if (persona.wearable) {
    const w = persona.wearable;
    const rows = [];
    for (let d = 0; d < w.days; d++) {
      rows.push({
        patient_id: patientId,
        day: isoDaysAgo(d),
        steps: Math.round(w.steps + (Math.random() - 0.5) * 2 * w.stepsSd),
        resting_hr: w.restingHr,
        hrv_ms: w.hrvMs,
        sleep_hours: w.sleepHours,
        avg_glucose_mgdl: w.avgGlucose ?? null,
        time_in_range_pct: w.timeInRangePct ?? null,
      });
    }
    await admin.from("wearable_daily").insert(rows);
  }

  // Scans
  if (persona.scans.length) {
    await admin.from("scans").insert(
      persona.scans.map((s) => ({
        patient_id: patientId,
        modality: s.modality,
        origin: s.origin,
        finding_summary: s.findingSummary,
        deidentified: s.deidentified,
        scan_date: isoDateAgo(s.ago),
        storage_path: null,
      })),
    );
  }

  // Research consents
  if (persona.researchConsents.length) {
    await admin.from("research_consents").insert(
      persona.researchConsents.map((c) => ({
        patient_id: patientId,
        data_type: c.dataType,
        research_type: c.researchType,
        allowed: c.allowed,
      })),
    );
  }

  // Contact prefs
  await admin.from("contact_preferences").insert({
    patient_id: patientId,
    allow_invitations: persona.contactPrefs.allowInvitations,
    condition_categories: persona.contactPrefs.conditionCategories,
  });

  // Consent events
  const consentRows = persona.consents.map((ct) => ({
    patient_id: patientId,
    consent_type: ct,
    consent_version: CONSENT_VERSION,
    text_sha256: hashText(CONSENT_TEXT[ct as ConsentType] ?? ct),
    granted: true,
    scope: {},
  }));
  // research consent events per allowed cell
  for (const c of persona.researchConsents) {
    if (c.allowed) {
      consentRows.push({
        patient_id: patientId,
        consent_type: "research",
        consent_version: CONSENT_VERSION,
        text_sha256: hashText(CONSENT_TEXT.research),
        granted: true,
        scope: { data_type: c.dataType, research_type: c.researchType } as Record<string, string>,
      });
    }
  }
  if (consentRows.length) await admin.from("consent_events").insert(consentRows);

  // Earnings
  if (persona.earnings.length) {
    await admin.from("donor_earnings").insert(
      persona.earnings.map((e) => ({
        patient_id: patientId,
        kind: e.kind,
        amount_cents: e.amountCents,
        description: e.description,
        status: "accrued",
        created_at: dateFromAgo(e.ago),
      })),
    );
  }
}

function dateFromAgo(ago: { months?: number; days?: number }): string {
  const d = new Date();
  if (ago.months) d.setMonth(d.getMonth() - ago.months);
  if (ago.days) d.setDate(d.getDate() - ago.days);
  return d.toISOString();
}

async function insertSyntheticPatients(admin: Admin): Promise<number> {
  const synthetic = generateSyntheticPatients(200);
  let count = 0;

  for (const p of synthetic) {
    const { data: patient, error } = await admin
      .from("patients")
      .insert({
        user_id: null,
        display_name: p.displayName,
        date_of_birth: birthDateForAge(p.ageYears),
        sex: p.sex,
        town: p.town,
        lat: p.lat,
        lon: p.lon,
        travel_radius_miles: p.travelRadiusMiles,
        preferred_language: p.preferredLanguage,
        is_donor: p.isDonor,
        is_synthetic: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`synthetic insert failed: ${error.message}`);
    const patientId = patient.id;

    if (p.facts.length) {
      await admin.from("patient_facts").insert(
        p.facts.map((f) => ({
          patient_id: patientId,
          field: f.field,
          label: vocabLabel(f.field),
          value_num: typeof f.value === "number" ? f.value : null,
          value_bool: typeof f.value === "boolean" ? f.value : null,
          value_text: null,
          unit: f.unit,
          observed_at: isoDaysAgo(f.observedDaysAgo),
          source: "demo",
          status: "confirmed",
        })),
      );
    }

    if (p.connectedSources.length) {
      await admin.from("connected_sources").insert(
        p.connectedSources.map((s) => ({ patient_id: patientId, source: s, is_demo: true })),
      );
    }

    if (p.wearableDays.length) {
      await admin.from("wearable_daily").insert(
        p.wearableDays.map((w) => ({
          patient_id: patientId,
          day: isoDaysAgo(w.dayOffset),
          steps: w.steps,
          resting_hr: w.restingHr,
          hrv_ms: w.hrvMs,
          sleep_hours: w.sleepHours,
          avg_glucose_mgdl: w.avgGlucose,
          time_in_range_pct: w.timeInRange,
        })),
      );
    }

    if (p.researchConsents.length) {
      await admin.from("research_consents").insert(
        p.researchConsents.map((c) => ({
          patient_id: patientId,
          data_type: c.dataType,
          research_type: c.researchType,
          allowed: c.allowed,
        })),
      );
    }

    await admin.from("contact_preferences").insert({
      patient_id: patientId,
      allow_invitations: p.contactPrefs.allowInvitations,
      condition_categories: p.contactPrefs.conditionCategories,
    });

    count++;
  }

  return count;
}
