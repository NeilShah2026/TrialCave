import { describe, expect, it } from "vitest";

import { ROLE_HOME } from "@/lib/types";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";

describe("foundation wiring", () => {
  it("maps every role to a home route", () => {
    expect(ROLE_HOME.patient).toBe("/app");
    expect(ROLE_HOME.clinic).toBe("/clinic");
    expect(ROLE_HOME.researcher).toBe("/enclave");
    expect(ROLE_HOME.admin).toBe("/admin");
  });

  it("defines the eight demo accounts with valid roles", () => {
    expect(DEMO_ACCOUNTS).toHaveLength(8);
    for (const a of DEMO_ACCOUNTS) {
      expect(a.email).toMatch(/@example\.com$/);
      expect(ROLE_HOME[a.role]).toBeTruthy();
    }
  });
});
