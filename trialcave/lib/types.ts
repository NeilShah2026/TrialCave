/**
 * Core shared domain types. Database row types are added as the schema lands in
 * later phases; this file holds the stable enums and small shapes used across
 * the app.
 */

export type Role = "patient" | "clinic" | "researcher" | "admin";

export type Language = "en" | "es" | "pt" | "ht";

export type MatchStatus = "strong" | "possible" | "needs_info" | "ineligible";

export type CriterionStatus = "pass" | "fail" | "unknown" | "na";

export interface SessionUser {
  userId: string;
  role: Role;
  email: string;
}

/** Where a role lands after signing in (B6.2). */
export const ROLE_HOME: Record<Role, string> = {
  patient: "/app",
  clinic: "/clinic",
  researcher: "/enclave",
  admin: "/admin",
};
