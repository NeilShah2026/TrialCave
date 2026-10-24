-- TrialCave row-level security (B7.3). Apply after 0001_schema.sql.

-- Enable RLS on every table
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','patients','source_documents','patient_facts','wearable_daily','connected_sources','scans',
    'research_consents','consent_events','contact_preferences','clinics','muted_clinics','trials','trial_criteria',
    'criterion_answers','match_results','match_changes','applications','invitations','translations',
    'research_partners','research_projects','enclave_runs','donor_contributions','donor_earnings','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiles: own row only
create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());

-- Patient-owned tables: the patient only. No clinic or researcher policies, ever.
create policy "own patient read" on public.patients for select using (user_id = auth.uid());

create policy "own documents read" on public.source_documents for select using (patient_id = public.my_patient_id());
create policy "own facts read" on public.patient_facts for select using (patient_id = public.my_patient_id());
create policy "own wearables read" on public.wearable_daily for select using (patient_id = public.my_patient_id());
create policy "own sources read" on public.connected_sources for select using (patient_id = public.my_patient_id());
create policy "own scans read" on public.scans for select using (patient_id = public.my_patient_id());
create policy "own research consents read" on public.research_consents for select using (patient_id = public.my_patient_id());
create policy "own consent events read" on public.consent_events for select using (patient_id = public.my_patient_id());
create policy "own contact prefs read" on public.contact_preferences for select using (patient_id = public.my_patient_id());
create policy "own muted read" on public.muted_clinics for select using (patient_id = public.my_patient_id());
create policy "own answers read" on public.criterion_answers for select using (patient_id = public.my_patient_id());
create policy "own matches read" on public.match_results for select using (patient_id = public.my_patient_id());
create policy "own changes read" on public.match_changes for select using (patient_id = public.my_patient_id());
create policy "own applications read" on public.applications for select using (patient_id = public.my_patient_id());
create policy "own invitations read" on public.invitations for select using (patient_id = public.my_patient_id());
create policy "own contributions read" on public.donor_contributions for select using (patient_id = public.my_patient_id());
create policy "own earnings read" on public.donor_earnings for select using (patient_id = public.my_patient_id());
-- All patient writes go through server actions (service role) so that re-matching,
-- consent events and audit logging always happen. That's why only SELECT policies exist above.

-- Trials are public to read (library). Writes happen server-side only.
create policy "trials public read" on public.trials for select
  using (source = 'ctgov' or study_status = 'active');
create policy "criteria public read" on public.trial_criteria for select using (true);
create policy "translations public read" on public.translations for select using (true);

-- Clinics: owner reads own clinic. All clinic views of patients go through server code.
create policy "own clinic read" on public.clinics for select using (owner_user_id = auth.uid());

-- Researchers: own partner, projects, runs. No access to patient tables.
create policy "own partner read" on public.research_partners for select using (user_id = auth.uid());
create policy "own projects read" on public.research_projects for select
  using (partner_id in (select id from public.research_partners where user_id = auth.uid()));
create policy "own runs read" on public.enclave_runs for select
  using (project_id in (
    select p.id from public.research_projects p
    join public.research_partners r on r.id = p.partner_id
    where r.user_id = auth.uid()));

-- audit_log: no client policies (server only)
