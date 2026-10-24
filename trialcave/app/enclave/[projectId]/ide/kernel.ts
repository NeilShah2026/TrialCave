/**
 * Simulated Enclave kernel for the IDE. It doesn't execute code. It reads the
 * script, applies the Enclave's rules (aggregates only, no identifiers, no
 * egress), and produces believable console output. Calls to approved
 * analyses (`enclave.run("key")`) are handed back so the IDE can run them
 * for real through the existing server action.
 */

import type { Lang } from "./highlight";

export type LineKind = "cmd" | "info" | "out" | "ok" | "warn" | "err" | "dim";

export type Step =
  | { kind: "line"; line: ConsoleLine; delay: number }
  | { kind: "analysis"; key: string; delay: number }
  | { kind: "blocked"; delay: number };

export interface ConsoleLine {
  kind: LineKind;
  text: string;
}

export interface Problem {
  line: number;
  severity: "error" | "warning";
  message: string;
}

export interface KernelContext {
  fileName: string;
  lang: Lang;
  poolCount: number;
  kMin: number;
  approved: { key: string; label: string }[];
  dataTypes: string[];
}

/** Fields that exist in the de-identified dataset, by data type. */
export const SCHEMA: { table: string; needs: string | null; fields: { name: string; type: string; note?: string }[] }[] = [
  {
    table: "donors",
    needs: null,
    fields: [
      { name: "donor_id", type: "opaque", note: "Random key, rotates per project" },
      { name: "age_band", type: "text" },
      { name: "sex", type: "text" },
      { name: "vulnerability_band", type: "text", note: "Town-level, never finer" },
      { name: "diabetes_duration_years", type: "int" },
    ],
  },
  {
    table: "labs",
    needs: "labs",
    fields: [
      { name: "hba1c", type: "float" },
      { name: "ldl", type: "float" },
      { name: "egfr", type: "float" },
      { name: "measured_year", type: "int", note: "Year only" },
    ],
  },
  {
    table: "wearables",
    needs: "wearables",
    fields: [
      { name: "avg_daily_steps", type: "int" },
      { name: "cgm_time_in_range", type: "float" },
    ],
  },
  {
    table: "imaging",
    needs: "imaging",
    fields: [{ name: "has_retinopathy", type: "bool" }],
  },
  {
    table: "history",
    needs: "history",
    fields: [
      { name: "condition_group", type: "text" },
      { name: "medication_class", type: "text" },
    ],
  },
];

const IDENTIFIERS = ["name", "first_name", "last_name", "full_name", "address", "street", "email", "phone", "dob", "date_of_birth", "birthdate", "ssn", "mrn", "zipcode", "zip_code", "postal_code"];
const EGRESS = [
  /\.to_(csv|excel|parquet|json|pickle)\s*\(/,
  /\bopen\s*\([^)]*['"][wa]\+?['"]/,
  /\b(requests|urllib|httpx|socket|ftplib|smtplib|boto3)\b/,
  /\b(write\.csv|write\.table|saveRDS|download\.file|httr::)/,
  /\benclave\.(export_raw|download|rows)\s*\(/,
  /\bcohort\.(rows|records|raw)\b/,
  /\bINTO\s+OUTFILE\b/i,
  /\bCOPY\b.+\bTO\b/i,
];

const lineOf = (code: string, index: number) => code.slice(0, index).split("\n").length;

/** Live problems for the Problems panel (cheap, runs on every edit). */
export function analyze(code: string, ctx: Pick<KernelContext, "lang" | "approved">): Problem[] {
  const problems: Problem[] = [];
  if (ctx.lang === "markdown" || ctx.lang === "text") return problems;
  const lines = code.split("\n");
  const commentMark = ctx.lang === "sql" ? "--" : "#";

  lines.forEach((raw, i) => {
    const line = stripComment(raw, commentMark);
    if (!line.trim()) return;
    // Words inside a print()/cat() message are just text, so ignore those strings.
    const checkable = /^\s*(print|cat|message)\s*\(/.test(line) ? line.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""') : line;
    const id = IDENTIFIERS.find((f) => new RegExp(`\\b${f}\\b`, "i").test(checkable));
    if (id) {
      problems.push({ line: i + 1, severity: "error", message: `"${id}" is an identifier and isn't in the de-identified dataset.` });
    }
    if (EGRESS.some((re) => re.test(line))) {
      problems.push({ line: i + 1, severity: "error", message: "Writes or sends data out of the Enclave. Only aggregate results can leave." });
    }
    for (const m of line.matchAll(/\b(?:enclave\.run|run_analysis|enclave_run)\s*\(\s*["']([\w-]+)["']/g)) {
      if (!ctx.approved.some((a) => a.key === m[1])) {
        problems.push({ line: i + 1, severity: "error", message: `Analysis "${m[1]}" isn't approved for this project.` });
      }
    }
    if (ctx.lang === "sql" && /^\s*select\s+\*/i.test(line)) {
      problems.push({ line: i + 1, severity: "warning", message: "SELECT * returns rows. Group and aggregate instead." });
    }
  });

  const unbalanced = findUnbalanced(code, commentMark);
  if (unbalanced) problems.push({ line: unbalanced.line, severity: "error", message: unbalanced.message });

  if (ctx.lang === "sql" && code.trim() && !/\bgroup\s+by\b/i.test(stripAllComments(code, "--"))) {
    problems.push({ line: 1, severity: "warning", message: "Query has no GROUP BY. The Enclave only releases aggregates." });
  }
  return problems.sort((a, b) => a.line - b.line);
}

function stripComment(line: string, mark: string) {
  // Good enough: ignore marks inside quotes.
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (line.startsWith(mark, i)) return line.slice(0, i);
  }
  return line;
}

function stripAllComments(code: string, mark: string) {
  return code
    .split("\n")
    .map((l) => stripComment(l, mark))
    .join("\n");
}

function findUnbalanced(code: string, mark: string): { line: number; message: string } | null {
  const stack: { c: string; i: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const src = stripAllComments(code, mark);
  let q: string | null = null;
  let tripleQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (tripleQ) {
        if (src.startsWith(q.repeat(3), i)) {
          q = null;
          i += 2;
        }
      } else if (c === "\\") i++;
      else if (c === q) q = null;
      else if (c === "\n") return { line: lineOf(src, i), message: "String is never closed on this line." };
      continue;
    }
    if (c === '"' || c === "'") {
      tripleQ = src.startsWith(c.repeat(3), i);
      q = c;
      if (tripleQ) i += 2;
    } else if (c === "(" || c === "[" || c === "{") stack.push({ c, i });
    else if (pairs[c]) {
      const top = stack.pop();
      if (!top || top.c !== pairs[c]) return { line: lineOf(src, i), message: `Unexpected "${c}".` };
    }
  }
  if (q) return { line: lineOf(src, src.length), message: "String is never closed." };
  const open = stack.pop();
  if (open) return { line: lineOf(src, open.i), message: `"${open.c}" was never closed.` };
  return null;
}

/** Stable pseudo-random numbers from the script text, so reruns look consistent. */
function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const AGE_BANDS = ["18–29", "30–39", "40–49", "50–59", "60–69", "70+"];

/** Fixed-width table for the console. */
export function asciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("   ").trimEnd();
  return [fmt(headers), widths.map((w) => "─".repeat(w)).join("   "), ...rows.map(fmt)];
}

/** Turn a script into a timed list of console steps. */
export function plan(code: string, ctx: KernelContext): Step[] {
  const steps: Step[] = [];
  const say = (kind: LineKind, text: string, delay = 90) => steps.push({ kind: "line", line: { kind, text }, delay });
  const rand = seeded(code + ctx.fileName);
  const runtime = ctx.lang === "sql" ? "enclave-sql 2.4" : ctx.lang === "r" ? "R 4.4.1" : "Python 3.12.4";

  say("cmd", `$ enclave run ${ctx.fileName}`, 0);

  if (ctx.lang === "markdown" || ctx.lang === "text") {
    say("warn", `${ctx.fileName} isn't a script. Open a .py, .sql or .R file to run it.`, 150);
    return steps;
  }

  say("dim", `Connecting to Enclave kernel (${runtime})…`, 260);
  say("info", `Mounted de-identified cohort · ${ctx.poolCount} donors · ${ctx.dataTypes.join(", ") || "core fields"}`, 380);
  say("dim", `Policy: aggregates only · groups under ${ctx.kMin} are hidden · no network egress`, 160);

  const problems = analyze(code, ctx);
  const errors = problems.filter((p) => p.severity === "error");
  if (errors.length) {
    const egress = errors.find((e) => e.message.startsWith("Writes or sends"));
    for (const e of errors.slice(0, 3)) {
      const kind = egress === e ? "EnclaveEgressError" : e.message.includes("identifier") ? "PolicyError" : e.message.includes("approved") ? "PermissionError" : "SyntaxError";
      say("err", `  File "${ctx.fileName}", line ${e.line}`, 220);
      say("err", `${kind}: ${e.message}`, 40);
    }
    if (egress) steps.push({ kind: "blocked", delay: 0 });
    say("dim", "Run stopped. Nothing left the Enclave.", 200);
    return steps;
  }

  const lines = code.split("\n");
  const commentMark = ctx.lang === "sql" ? "--" : "#";
  let produced = 0;

  if (ctx.lang === "sql") {
    const sql = stripAllComments(code, "--");
    say("ok", "Query plan validated: aggregate output only.", 300);
    const cols = (sql.match(/select\s+([^]*?)\s+from\s/i)?.[1] ?? "group, count(*)")
      .split(",")
      .map((c) => c.trim().split(/\s+as\s+/i).pop()!.replace(/[^\w]/g, "") || "value");
    const rows = AGE_BANDS.map((band) => {
      const n = Math.round(4 + rand() * 40);
      return cols.map((c, i) => {
        if (i === 0) return band;
        if (n < ctx.kMin) return i === 1 ? `<${ctx.kMin}` : "—";
        if (/count|people|^n$/i.test(c)) return String(n);
        if (/a1c/i.test(c)) return (6.1 + rand() * 2.2).toFixed(1);
        if (/step/i.test(c)) return String(Math.round(4200 + rand() * 4800));
        return (rand() * 100).toFixed(1);
      });
    });
    const hidden = rows.filter((r) => r[1]?.startsWith("<")).length;
    say("dim", `Scanned ${ctx.poolCount} donors in ${(0.18 + rand() * 0.6).toFixed(2)}s`, 520);
    for (const l of asciiTable(cols, rows)) say("out", l, 35);
    if (hidden) say("warn", `${hidden} group${hidden > 1 ? "s" : ""} hidden (fewer than ${ctx.kMin} people).`, 120);
    produced = rows.length - hidden;
  } else {
    // Remember simple assignments so print(x) can describe what x holds.
    const vars = new Map<string, string>();
    for (let i = 0; i < lines.length; i++) {
      const line = stripComment(lines[i], commentMark).trim();
      if (!line) continue;
      const assign = line.match(/^([A-Za-z_.][\w.]*)\s*(?:<-|=(?!=))\s*(.+)$/);
      if (assign) vars.set(assign[1], assign[2]);

      for (const m of line.matchAll(/\b(?:enclave\.run|run_analysis|enclave_run)\s*\(\s*["']([\w-]+)["']/g)) {
        steps.push({ kind: "analysis", key: m[1], delay: 260 });
        produced++;
      }

      const printed = line.match(/^(?:print|cat|message)\s*\((.*)\)\s*$/);
      if (printed) {
        say("out", renderPrint(printed[1], ctx, rand, vars), 140);
        produced++;
        continue;
      }
      if (/\.(show|head|describe|summary)\s*\(\s*\)\s*$/.test(line) || /^summary\s*\(/.test(line)) {
        say("dim", "(aggregate view, see table above)", 60);
        continue;
      }
      if (/\.groupby\(|group_by\(|aggregate\(|tapply\(/.test(line)) {
        const groups = 3 + Math.floor(rand() * 4);
        const hidden = Math.floor(rand() * 2);
        say("info", `Line ${i + 1}: grouped into ${groups} bands · ${hidden ? `${hidden} hidden (n < ${ctx.kMin})` : "all groups shown"}`, 300);
      }
    }
  }

  const secs = (0.6 + rand() * 1.4).toFixed(2);
  steps.push({ kind: "line", line: { kind: "ok", text: `✓ Finished in ${secs}s · ${produced} aggregate output${produced === 1 ? "" : "s"} · 0 individual rows left the Enclave` }, delay: 320 });
  return steps;
}

/** Render a print()/cat() argument the way the kernel would. */
function renderPrint(arg: string, ctx: KernelContext, rand: () => number, vars: Map<string, string>): string {
  const a = arg.trim();
  const ev = (e: string) => evalExpr(e, ctx, rand, vars);
  const lit = a.match(/^[fF]?(["'])(.*)\1$/);
  if (lit) {
    return lit[2].replace(/\{([^}]+)\}/g, (_, expr: string) => ev(expr)).replace(/\\n/g, " ");
  }
  // paste("a", x) / "a", x  → join pieces
  const pieces = a.replace(/^paste0?\(|\)$/g, "").split(/,(?![^(]*\))/);
  if (pieces.length > 1) {
    return pieces
      .map((p) => {
        const s = p.trim().match(/^(["'])(.*)\1$/);
        return s ? s[2] : ev(p);
      })
      .join(" ");
  }
  return ev(a);
}

function evalExpr(expr: string, ctx: KernelContext, rand: () => number, vars: Map<string, string>, depth = 0): string {
  const e = expr.trim();
  const known = vars.get(e);
  if (known && depth < 4) return evalExpr(known, ctx, rand, vars, depth + 1);
  if (/^enclave\.cohort\(|^enclave_cohort\(/.test(e)) return `<Cohort: ${ctx.poolCount} de-identified donors, row access disabled>`;
  if (/^len\(|^nrow\(|\.count\(\)|^length\(/.test(e)) return String(ctx.poolCount);
  if (/^\d+(\.\d+)?$/.test(e)) return e;
  // Grouped summaries print one value per band (small bands hidden).
  if (/groupby|group_by|tapply|aggregate\(/i.test(e)) {
    const metric = (lo: number, span: number, digits: number) => (lo + rand() * span).toFixed(digits);
    const value = /step/i.test(e) ? () => metric(4200, 4800, 0) : /range|tir/i.test(e) ? () => `${metric(45, 35, 1)}%` : () => metric(6.1, 2.0, 2);
    return AGE_BANDS.map((b, i) => `${b}: ${i === 0 ? `<${ctx.kMin} hidden` : value()}`).join("   ");
  }
  if (/a1c/i.test(e)) return (6.4 + rand() * 1.6).toFixed(2);
  if (/step/i.test(e)) return String(Math.round(5200 + rand() * 3000));
  if (/range|tir/i.test(e)) return `${(48 + rand() * 30).toFixed(1)}%`;
  if (/mean|median|avg/i.test(e)) return (rand() * 10).toFixed(2);
  return `<${e}: aggregate>`;
}
