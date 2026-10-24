-- TrialCave schema (B7.2). Apply before 0002_rls.sql and 0003_storage.sql.

create extension if not exists pgcrypto;

-- ===== Accounts =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('patient','clinic','researcher','admin')),
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

-- ===== Patients & Data Donors =====
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade, -- null for synthetic background patients
  display_name text not null,
  date_of_birth date not null,                 -- 18+ enforced in server action (B0 rule 12)
  sex text not null check (sex in ('female','male')),  -- sex assigned at birth, as trials define it
  town text not null,                          -- from lib/geo/towns.ts; no precise location
  lat double precision not null,               -- town centroid, not the person's address
  lon double precision not null,
  travel_radius_miles int not null default 25,
  preferred_language text not null default 'en' check (preferred_language in ('en','es','pt','ht')),
  is_donor boolean not null default false,
  is_synthetic boolean not null default false,
  research_withdrawn boolean not null default false,
  inbox_token text unique,                     -- 12 lowercase alphanumerics; null until email ingest is turned on
  email_ingest_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  origin text not null check (origin in ('upload','email','demo')),
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','text/plain')),
  size_bytes int not null,
  sha256 text not null,
  storage_path text,                           -- documents/<user_id>/<doc_id>/<file_name>
  email_from text,                             -- only for origin='email'
  email_subject text,
  document_date date,                          -- visit/report date from extraction
  facility_name text,                          -- from extraction
  status text not null default 'processing'
    check (status in ('processing','needs_review','reviewed','failed','rejected')),
  error text,
  extraction_source text check (extraction_source in ('ai','fixture')),
  created_at timestamptz not null default now(),
  unique (patient_id, sha256)                  -- the same file twice is a no-op
);

create table public.patient_facts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  field text,                                  -- vocabulary field (B9.1) or null for display-only facts
  label text not null,                         -- plain label shown to the patient
  value_num numeric,
  value_bool boolean,
  value_text text,
  unit text,
  observed_at date,
  source text not null check (source in ('lab','wearable','self_report','portal','imaging','document','demo')),
  document_id uuid references public.source_documents(id) on delete set null,
  source_quote text,                           -- required when source='document'
  status text not null default 'confirmed' check (status in ('pending','confirmed','rejected')),
  created_at timestamptz not null default now(),
  constraint document_facts_have_quote check (source <> 'document' or source_quote is not null)
);
create index on public.patient_facts (patient_id, field, observed_at desc);
create index on public.patient_facts (document_id);

-- Only confirmed vocabulary facts count for matching. Latest observation wins.
create view public.patient_current_facts with (security_invoker = true) as
  select distinct on (patient_id, field) *
  from public.patient_facts
  where status = 'confirmed' and field is not null
  order by patient_id, field, observed_at desc nulls last, created_at desc;

create table public.wearable_daily (
  patient_id uuid not null references public.patients(id) on delete cascade,
  day date not null,
  steps int,
  resting_hr int,
  hrv_ms int,
  sleep_hours numeric(4,2),
  avg_glucose_mgdl int,
  time_in_range_pct int,
  primary key (patient_id, day)
);  -- no location columns, by design

create table public.connected_sources (
  patient_id uuid not null references public.patients(id) on delete cascade,
  source text not null check (source in ('apple_health','google_health_connect','fitbit','oura','whoop','dexcom','patient_portal')),
  connected_at timestamptz not null default now(),
  is_demo boolean not null default true,
  primary key (patient_id, source)
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  modality text not null check (modality in ('mri','ultrasound','retinal','dermatology','ct','xray','pet','mammogram')),
  origin text not null check (origin in ('existing_upload','partner_center')),
  body_part text,
  scan_date date,
  storage_path text,
  finding_summary text,
  deidentified boolean not null default false,
  incidental_findings_ack boolean not null default false,
  created_at timestamptz not null default now(),
  constraint partner_scans_no_radiation check (
    origin <> 'partner_center' or modality in ('mri','ultrasound','retinal','dermatology')
  ),
  constraint partner_scans_ack check (
    origin <> 'partner_center' or incidental_findings_ack = true
  )
);

-- Current research consent state (one row per data type × research type)
create table public.research_consents (
  patient_id uuid not null references public.patients(id) on delete cascade,
  data_type text not null check (data_type in ('wearables','labs','imaging','history')),
  research_type text not null check (research_type in ('academic','pharma','ai','device')),
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (patient_id, data_type, research_type)
);

-- Append-only record of every consent decision (C3.4, C4)
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  consent_type text not null check (consent_type in
    ('terms','privacy_notice','donor_agreement','research','contact','email_ingest','share_application','share_invitation')),
  consent_version text not null,               -- CONSENT_VERSION at the time
  text_sha256 text not null,                   -- hash of the exact text shown
  granted boolean not null,
  scope jsonb not null default '{}',           -- e.g. {"data_type":"labs","research_type":"pharma"}
  created_at timestamptz not null default now()
);
create index on public.consent_events (patient_id, created_at desc);

create table public.contact_preferences (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  allow_invitations boolean not null default false,
  condition_categories text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- array_to_string is STABLE, and generated columns only accept IMMUTABLE expressions,
-- so the trials.search column uses this wrapper.
create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text language sql immutable parallel safe as $$ select array_to_string(arr, sep) $$;

-- ===== Clinics & Trials =====
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  town text not null,
  lat double precision not null,
  lon double precision not null,
  verified boolean not null default false,
  irb_on_file boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.muted_clinics (
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, clinic_id)
);

create table public.trials (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('ctgov','clinic')),
  nct_id text unique,
  clinic_id uuid references public.clinics(id) on delete cascade,
  title text not null,
  official_title text,
  brief_summary text,
  plain_summary text,                          -- English; translations live in public.translations
  what_is_involved text,
  logistics jsonb not null default '{}',       -- {visit_count, duration_weeks, remote_option, compensation_mentioned}
  conditions text[] not null default '{}',
  condition_category text not null default 'other'
    check (condition_category in ('diabetes_metabolic','cardiology','kidney','oncology','neurology','other')),
  phases text[] not null default '{}',
  overall_status text not null default 'RECRUITING',
  study_type text,
  sponsor text,
  min_age_years numeric,
  max_age_years numeric,
  sex text not null default 'ALL' check (sex in ('ALL','FEMALE','MALE')),
  healthy_volunteers boolean,
  eligibility_text text,
  enrollment int,
  locations jsonb not null default '[]',       -- [{facility,city,state,zip,country,status,lat,lon}]
  contacts jsonb not null default '[]',        -- [{name,role,phone,email}]
  ctgov_last_updated date,
  parse_status text not null default 'pending' check (parse_status in ('pending','parsed','failed')),
  study_status text not null default 'active' check (study_status in ('draft','active','closed')),
  -- Clinic studies only: IRB details and the approved invitation text (C3.7)
  irb_protocol_number text,
  invite_message text,
  invite_message_attested_by uuid references auth.users(id),
  invite_message_attested_at timestamptz,
  is_demo boolean not null default false,
  search tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(brief_summary,'') || ' ' || public.immutable_array_to_string(conditions,' '))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_study_active_needs_irb check (
    source <> 'clinic' or study_status <> 'active'
    or (irb_protocol_number is not null and invite_message is not null and invite_message_attested_at is not null)
  )
);
create index on public.trials using gin (search);

create table public.trial_criteria (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials(id) on delete cascade,
  kind text not null check (kind in ('inclusion','exclusion')),
  original_text text not null,
  plain_text text not null,
  category text not null check (category in ('demographic','diagnosis','lab','medication','vital','history','lifestyle','logistics','other')),
  field text,
  operator text check (operator in ('gte','lte','between','eq','present','absent')),
  value_min numeric,
  value_max numeric,
  value_text text,
  unit text,
  machine_checkable boolean not null default false,
  patient_question text,
  sort_order int not null default 0
);
create index on public.trial_criteria (trial_id);

-- ===== Matching =====
create table public.criterion_answers (
  patient_id uuid not null references public.patients(id) on delete cascade,
  criterion_id uuid not null references public.trial_criteria(id) on delete cascade,
  answer text not null check (answer in ('yes','no','unsure')),
  answered_at timestamptz not null default now(),
  primary key (patient_id, criterion_id)
);

create table public.match_results (
  patient_id uuid not null references public.patients(id) on delete cascade,
  trial_id uuid not null references public.trials(id) on delete cascade,
  status text not null check (status in ('strong','possible','needs_info','ineligible')),
  score numeric not null,
  pass_count int not null,
  fail_count int not null,
  unknown_count int not null,
  details jsonb not null,                      -- CriterionResult[] (B9.4)
  distance_miles numeric,
  computed_at timestamptz not null default now(),
  primary key (patient_id, trial_id)
);
create index on public.match_results (trial_id, status);

-- One row per trial whose status changed because of a patient action (B9.7)
create table public.match_changes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  trial_id uuid not null references public.trials(id) on delete cascade,
  from_status text,                            -- null = trial newly appeared
  to_status text,                              -- null = trial no longer listed (prefiltered out)
  from_score numeric,
  to_score numeric,
  trigger_type text not null check (trigger_type in ('document','answer','profile_edit','connector','lab_entry')),
  trigger_id text,                             -- document id, criterion id, field name, or source
  trigger_label text not null,                 -- "Your Oct 20 visit (Quincy Family Health)"
  changed_criteria jsonb not null default '[]',-- [{criterionId, plainText, from, to, reason}]
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.match_changes (patient_id, created_at desc);

-- ===== Patient → Clinic =====
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  trial_id uuid not null references public.trials(id) on delete cascade,
  shared_fields text[] not null,
  status text not null default 'submitted' check (status in ('submitted','under_review','contacted','not_a_fit','withdrawn')),
  created_at timestamptz not null default now(),
  unique (patient_id, trial_id)
);

-- ===== Clinic → Patient =====
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trials(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined','expired','withdrawn')),
  message text not null,                       -- copied from trials.invite_message (IRB-approved)
  match_score numeric not null,
  shared_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  responded_at timestamptz,
  unique (trial_id, patient_id)                -- one invitation per patient per study
);

-- ===== Translations cache =====
create table public.translations (
  source_sha256 text not null,                 -- sha256 of the English source text
  lang text not null check (lang in ('es','pt','ht')),
  text text not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (source_sha256, lang)
);

-- ===== Enclave =====
create table public.research_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade, -- null for seeded partners without a login
  org_name text not null,
  verified boolean not null default false
);

create table public.research_projects (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.research_partners(id) on delete cascade,
  title text not null,
  description text not null,
  data_types text[] not null,
  research_type text not null check (research_type in ('academic','pharma','ai','device')),
  allowed_analyses text[] not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  access_fee_per_run_cents int not null default 20000,
  created_at timestamptz not null default now()
);

create table public.enclave_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects(id) on delete cascade,
  analysis_key text not null,
  result jsonb not null,                       -- aggregate rows only, after suppression
  suppressed_cells int not null default 0,
  donor_count int not null,
  run_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.donor_contributions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  run_id uuid references public.enclave_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.donor_earnings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('donation','research_share')),
  amount_cents int not null check (amount_cents >= 0),
  description text not null,
  related_run_id uuid references public.enclave_runs(id) on delete set null,
  status text not null default 'accrued' check (status in ('accrued','paid','void')),
  created_at timestamptz not null default now()
);  -- no bank or tax identifiers are ever stored here (C3.1, C3.10)

-- ===== Audit =====
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',        -- never patient facts or document text
  created_at timestamptz not null default now()
);
create index on public.audit_log (created_at desc);

-- ===== Helpers =====
create or replace function public.my_patient_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.patients where user_id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
