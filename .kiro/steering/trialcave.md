# TrialCave build rules and language guide

These rules apply to every task in the TrialCave build. The source of truth is
`TrialCave_Master_Plan.md` (v1.0). Precedence on any conflict: **Part C > Part B > Part A**.
`SPEC.md` (the old "TrialPass" draft) is superseded and must not be followed.

## Team decisions that override the plan (most recent first)

- **Data-integrity trust tiers (anti-fraud).** Money only attaches to data with
  provenance. Every `patient_facts` row has a verification tier derived from its
  `source`:
  - `verified` — wearable/CGM device feed, patient portal, imaging, or
    clinic-attested. The user cannot edit the value (provenance by design).
  - `document_backed` — uploaded/photographed record with a required source quote,
    patient-confirmed. Evidence on file.
  - `self_reported` — typed by hand or a yes/no answer. No external evidence.
  Rule: the Enclave paid pool and donor payouts draw ONLY on `verified` and
  `document_backed` facts. `self_reported` facts are matching-only and NEVER earn
  money. Demo connectors are simulated device feeds the user can't edit (models the
  B2B/provenance guarantee). Live OAuth/FHIR/NPI/KYC are roadmap. Keep plausibility
  checks, source-quote requirement, SHA-256 dedup, k-anonymity, capped payouts, and
  audit as backstops.
- **Equity layer is town-level only (see earlier decision below).**

- **Inbound email is DEPRECATED.** Do not build the Postmark webhook
  (`/api/inbound/postmark`), the "Add records by email" settings panel, the
  `simulateForwardedEmail` action, or the inbound-email env vars
  (`POSTMARK_INBOUND_ADDRESS`, `INBOUND_WEBHOOK_SECRET`). Uploads are the only
  ingestion path. The `inbox_token` / `email_ingest_enabled` columns and the
  `email_ingest` consent type may remain in the schema unused.
- **Condition-agnostic trial library.** The ClinicalTrials.gov sync loads ALL
  recruiting Massachusetts trials (any condition), not just type 2 diabetes.
  `CTGOV_CONDITION` is blank by default. The library, trial detail, parsing, and
  matching must work for any condition. The deterministic matching vocabulary
  (B9.1) stays cardiometabolic-first by design (B20): trials outside it still load
  and match, leaning on AI-estimated and question-based criterion checks. Keep the
  vocabulary structured and extensible; never hard-code the app to one condition.
- **Equity layer (EJ / SVI), town-level only.** MassGIS EJ2020 and CDC/ATSDR SVI
  data may be joined to a patient's `town` ONLY — aggregate block-group / tract
  figures up to municipality. Never store tract or block-group per patient (Part C,
  B0 rule 11: no precise location). Use it for clinic equity views and Enclave
  stratification at community level, never to gate a patient's matches or single
  anyone out. Cite MassGIS / CDC as sources.

## Build rules (from B0 — apply everywhere)

1. **Patient data never reaches the browser of anyone but that patient.** All
   cross-party access (clinic ↔ patient, researcher ↔ data, inbound email) goes
   through server-side code (route handlers or server actions) using the Supabase
   service-role client, with explicit authorization checks from `lib/auth.ts`. The
   browser Supabase client is only used for the signed-in user's own rows.
2. **`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` and `INBOUND_WEBHOOK_SECRET`
   are server-only.** Never import them in a file that runs in the browser. Never
   prefix them with `NEXT_PUBLIC_`. Every file that uses them starts with
   `import "server-only";`.
3. **Follow the language guide (below)** in every UI string, email and slide.
4. **Demo banner:** when `NEXT_PUBLIC_DEMO_MODE=true`, every page shows a slim
   banner: "Demo environment. All patient data is synthetic."
5. **Footer on every page:** "TrialCave does not provide medical advice. Final
   eligibility is always decided by the study team." plus links to Terms, Privacy
   and How it works.
6. **Every page has loading, empty and error states.** No blank screens. No
   unhandled promise rejections.
7. **TypeScript strict mode. No `any`.** Validate all external data
   (ClinicalTrials.gov responses, LLM output, inbound email payloads, form input,
   uploaded file metadata) with `zod`.
8. **The demo must work if the AI API is down.** Demo clinic studies use
   hand-written criteria; the matching engine is deterministic code; demo
   documents carry a marker in their PDF metadata and have stored extraction
   fixtures. AI is only called for: parsing ClinicalTrials.gov trials ahead of
   time, parsing new clinic protocols, extracting facts from non-demo uploaded
   records, the optional "Check remaining criteria with AI" button, and translations.
9. **Seed and reset scripts are idempotent.** Running them twice gives the same result.
10. **No third-party trackers.** No analytics pixels, ad SDKs, session replay, or
    chat widgets on any page. Server logs must not contain patient facts or
    document contents.
11. **No precise location.** Store town and travel radius only. Never request
    browser geolocation. Drop any GPS or route data from wearable imports.
12. **Adults only.** Sign-up requires date of birth showing age 18 or older,
    checked on the server.
13. **No genetic data.** The extraction step drops germline genetic test results,
    and uploads can't be labeled genetic.
14. Before calling any phase done: `npm run typecheck`, `npm run lint`,
    `npm run test`, and `npm run build` all pass.

When something is ambiguous, pick the simplest option that keeps the demo (B18)
working, and leave a `// DECISION:` comment. If a Part C requirement conflicts with
Part B, follow Part C and leave a `// DECISION:` comment explaining it. Build phases
in order (B17); don't start a phase until the previous phase's acceptance checks pass.
Don't add features that aren't listed; don't skip listed ones.

## Language guide (A6.4 — applies to every UI string, email and slide)

| Say | Never say |
|---|---|
| Data Donor | Data seller, data vendor |
| Donate your data | Sell your data, monetize your data |
| Collect a paycheck / get compensated | Get paid for your data, cash out your data |
| Research partners | Data buyers, customers of your data |
| Research partners pay for analyses inside the Enclave | Data sales, data licensing |
| Your donation powered a study | Your data was sold / purchased |
| Pre-qualified, likely eligible | Guaranteed eligible, you qualify |
| De-identified (for donated data) | Anonymous data, 100% anonymous |
| Invitations stay anonymous until you approve | Clinics can't ever identify you |
| We follow strict privacy and security practices | HIPAA compliant, HIPAA certified |
| The study team makes the final decision | You're eligible / you're enrolled |

In legal documents, "paycheck" is a **Donor thank-you payment** — not wages, and it
does not create an employment relationship.

Banned substrings in UI copy (checked in Phase 10): "buyer", "monetiz", "sell your",
"HIPAA compliant", "guaranteed", "anonymous data". Every other use of "sell" must be a
negative ("We never sell").

## Always true (A6.5)

- Finding trials, matching and applying are **always free** for patients. Nobody
  needs to be a Data Donor to use them.
- **No one downloads a Donor's data.** Researchers run approved analyses inside the
  Enclave and export only aggregate results.
- **No clinic can contact a patient unless TrialCave routes it and the patient approves.**
- **We never sell personal data**, and the code has no endpoint that exports another
  person's records.
