import { describe, expect, it } from "vitest";

import { evaluateCriteria, type Answer } from "@/lib/matching/evaluate";
import { scoreTrial } from "@/lib/matching/score";
import { personaFactMap, studyCriteria, hba1cFact } from "./helpers";

const noAnswers = new Map<string, Answer>();

function score(email: string, title: string, extra = [] as ReturnType<typeof hba1cFact>[], answers = noAnswers) {
  const facts = personaFactMap(email, extra);
  const results = evaluateCriteria(studyCriteria(title), facts, answers);
  return { ...scoreTrial(results), results };
}

describe("B9.9 persona matching expectations", () => {
  it("Maria at seed (HbA1c 6.8): COMPASS-T2D ineligible, only fail is HbA1c below range", () => {
    const s = score("maria@example.com", "COMPASS-T2D");
    expect(s.status).toBe("ineligible");
    expect(s.failCount).toBe(1);
    const fails = s.results.filter((r) => r.status === "fail");
    expect(fails[0].field).toBe("hba1c_pct");
    // mi_6mo is unknown (not set on Maria).
    const mi = s.results.find((r) => r.field === "event:mi_6mo");
    expect(mi?.status).toBe("unknown");
  });

  it("Maria after visit summary (HbA1c 8.4): COMPASS-T2D strong, score >= 0.8", () => {
    const s = score("maria@example.com", "COMPASS-T2D", [hba1cFact(8.4)]);
    expect(s.status).toBe("strong");
    expect(s.score).toBeGreaterThanOrEqual(0.8);
    expect(s.failCount).toBe(0);
    // mi_6mo still unknown.
    expect(s.results.find((r) => r.field === "event:mi_6mo")?.status).toBe("unknown");
    // diabetes duration still satisfied (earliest diagnosis date used).
    const dur = s.results.find((r) => r.field === "diabetes_duration_years");
    expect(dur?.status).toBe("pass");
  });

  it("Maria after answering No to heart-attack question: COMPASS-T2D score 1.0", () => {
    const facts = personaFactMap("maria@example.com", [hba1cFact(8.4)]);
    const criteria = studyCriteria("COMPASS-T2D");
    const miCrit = criteria.find((c) => c.field === "event:mi_6mo")!;
    const answers = new Map<string, Answer>([[miCrit.id, "no"]]);
    const results = evaluateCriteria(criteria, facts, answers);
    const s = scoreTrial(results);
    expect(s.status).toBe("strong");
    expect(s.score).toBe(1);
    expect(s.unknownCount).toBe(0);
  });

  it("Maria: STRIDE ineligible (HbA1c above 6.4, has type 2 diabetes)", () => {
    const s = score("maria@example.com", "STRIDE");
    expect(s.status).toBe("ineligible");
  });

  it("James: COMPASS-T2D ineligible (insulin, eGFR 38, heart attack 6mo)", () => {
    const s = score("james@example.com", "COMPASS-T2D");
    expect(s.status).toBe("ineligible");
    const fails = s.results.filter((r) => r.status === "fail").map((r) => r.field);
    expect(fails).toContain("med:insulin");
    expect(fails).toContain("egfr");
    expect(fails).toContain("event:mi_6mo");
  });

  it("James: KIDNEY-SHIELD strong (score 0.8), cancer unknown", () => {
    const s = score("james@example.com", "KIDNEY-SHIELD");
    expect(s.status).toBe("strong");
    expect(s.score).toBeCloseTo(0.8, 5);
    expect(s.results.find((r) => r.field === "dx:cancer_active")?.status).toBe("unknown");
  });

  it("Priya: COMPASS-T2D ineligible (no type 2 diabetes, HbA1c below range)", () => {
    const s = score("priya@example.com", "COMPASS-T2D");
    expect(s.status).toBe("ineligible");
  });

  it("Priya: STRIDE strong (score ~0.83), bariatric unknown", () => {
    const s = score("priya@example.com", "STRIDE");
    expect(s.status).toBe("strong");
    expect(s.score).toBeCloseTo(5 / 6, 2);
    expect(s.results.find((r) => r.field === "event:bariatric_surgery")?.status).toBe("unknown");
  });
});
