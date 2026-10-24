/**
 * Demo accounts (B6.1). All organizations and people are fictional. All use
 * DEMO_PASSWORD. This list is also the allowlist used by the seed script.
 */
import type { Role } from "@/lib/types";

export interface DemoAccount {
  email: string;
  role: Role;
  /** Extra flag for patients who are also Data Donors. */
  donor?: boolean;
  name: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "maria@example.com",
    role: "patient",
    donor: true,
    name: "Maria Gonzalez, 54, Quincy",
    blurb: "Hero: forwarded visit summary flips COMPASS-T2D to a strong match.",
  },
  {
    email: "james@example.com",
    role: "patient",
    name: "James O'Brien, 67, Framingham",
    blurb: "Exclusion reasons; strong match for KIDNEY-SHIELD.",
  },
  {
    email: "priya@example.com",
    role: "patient",
    donor: true,
    name: "Priya Raman, 41, Cambridge",
    blurb: "Prediabetes; STRIDE match; pending invitation; heavy Data Donor.",
  },
  {
    email: "commonwealth@example.com",
    role: "clinic",
    name: "Commonwealth Metabolic Research Center, Boston",
    blurb: "Verified clinic running COMPASS-T2D and KIDNEY-SHIELD.",
  },
  {
    email: "northshore@example.com",
    role: "clinic",
    name: "Northshore Endocrine Research Group, Salem",
    blurb: "Verified clinic running STRIDE.",
  },
  {
    email: "newclinic@example.com",
    role: "clinic",
    name: "Pioneer Valley Research Associates, Springfield",
    blurb: "Unverified clinic: can't send invitations yet.",
  },
  {
    email: "researcher@example.com",
    role: "researcher",
    name: "Lexington University Digital Biomarkers Lab",
    blurb: "Runs approved Enclave analyses.",
  },
  {
    email: "admin@example.com",
    role: "admin",
    name: "TrialCave Admin",
    blurb: "Verify clinics, approve projects, audit log, reset demo.",
  },
];
