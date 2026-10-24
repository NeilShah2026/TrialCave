"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleX,
  Database,
  FileCode,
  FileText,
  Lock,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sigma,
  Sparkles,
  Square,
  Table2,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { AnalysisKey } from "@/lib/enclave/analyses";
import { logBlockedRawDownload, runAnalysisAction } from "../../actions";
import { LANG_LABEL, langFor, tokenizeLine, type Lang, type TokenType } from "./highlight";
import { SCHEMA, analyze, asciiTable, plan, type ConsoleLine, type KernelContext } from "./kernel";

/* ------------------------------------------------------------------ types */

interface IdeFile {
  id: string;
  name: string;
  content: string;
}
interface Workspace {
  files: IdeFile[];
  open: string[];
  active: string | null;
}

export interface EnclaveIdeProps {
  projectId: string;
  projectTitle: string;
  analyses: { key: AnalysisKey; label: string }[];
  kMin: number;
  poolCount: number;
  dataTypes: string[];
}

/* -------------------------------------------------------------- constants */

const LINE_H = 22; // px, shared by gutter, highlight layer and textarea
const PAD_Y = 14;
const INDENT = "    ";
const FILE_NAME = /^[\w-][\w.-]*\.(py|sql|r|md|txt)$/i;

const TOKEN_CLASS: Record<TokenType, string> = {
  plain: "",
  comment: "text-[#5f8a85] italic",
  string: "text-[#e9c48a]",
  number: "text-[#f0a28a]",
  keyword: "text-[#8fe3da] font-semibold",
  builtin: "text-[#7dd3c8]",
  func: "text-[#a9b8ff]",
  constant: "text-[#f0a28a]",
  operator: "text-[#9fc3be]",
  decorator: "text-[#e9c48a]",
  heading: "text-[#8fe3da] font-bold",
  punct: "text-[#7fa39e]",
};

const CONSOLE_CLASS: Record<ConsoleLine["kind"], string> = {
  cmd: "text-white font-semibold",
  info: "text-[#9fc3be]",
  out: "text-[#d7e7e4]",
  ok: "text-[#8fe3da]",
  warn: "text-[#e9c48a]",
  err: "text-[#f0a28a]",
  dim: "text-[#5f8a85]",
};

const RUNTIME: Record<Lang, string> = {
  python: "Python 3.12",
  sql: "enclave-sql 2.4",
  r: "R 4.4",
  markdown: "Markdown",
  text: "Text",
};

const storageKey = (projectId: string) => `tc-enclave-ide:v1:${projectId}`;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f${Math.random().toString(36).slice(2)}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function defaultFiles(p: EnclaveIdeProps): IdeFile[] {
  const key = p.analyses[0]?.key;
  const py = [
    `# ${p.projectTitle}`,
    "# Runs inside the TrialCave Enclave. Only aggregate results",
    `# (groups of ${p.kMin} or more people) can leave this workspace.`,
    "from trialcave import enclave",
    "",
    "cohort = enclave.cohort()  # de-identified donors approved for this project",
    'print(f"Donors in cohort: {len(cohort)}")',
    "",
    key ? "# Approved analyses run on the real donor pool." : "# No analyses are approved yet. Ask your TrialCave contact.",
    key ? `result = enclave.run("${key}")` : `# result = enclave.run("hba1c_by_age")`,
    key ? "result.show()" : "",
    "",
    "# Explore freely. Row-level exports are blocked by policy.",
    'by_band = cohort.groupby("age_band")["hba1c"].mean()',
    "print(by_band)",
    "",
  ].join("\n");
  const sql = [
    "-- Aggregate-only SQL. Row-level SELECTs are blocked.",
    "SELECT age_band,",
    "       COUNT(*)              AS people,",
    "       ROUND(AVG(hba1c), 1)  AS mean_hba1c",
    "FROM   donors",
    "JOIN   labs USING (donor_id)",
    "GROUP  BY age_band",
    `HAVING COUNT(*) >= ${p.kMin};`,
    "",
  ].join("\n");
  const md = [
    "# Workspace notes",
    "",
    "- Files save to **this browser** automatically.",
    "- `Ctrl+Enter` runs the open file. `Ctrl+S` saves.",
    "- `Ctrl+/` comments a line. `Esc` then `Tab` leaves the editor.",
    `- Groups smaller than ${p.kMin} people are always hidden.`,
    "- Names, addresses and exact dates aren't in the dataset.",
    "",
  ].join("\n");
  return [
    { id: uid(), name: "analysis.py", content: py },
    { id: uid(), name: "cohort.sql", content: sql },
    { id: uid(), name: "notes.md", content: md },
  ];
}

function loadWorkspace(p: EnclaveIdeProps): Workspace {
  try {
    const raw = window.localStorage.getItem(storageKey(p.projectId));
    if (raw) {
      const ws = JSON.parse(raw) as Workspace;
      if (Array.isArray(ws.files) && ws.files.every((f) => typeof f.id === "string" && typeof f.content === "string")) {
        const ids = new Set(ws.files.map((f) => f.id));
        const open = (ws.open ?? []).filter((id) => ids.has(id));
        return { files: ws.files, open, active: ws.active && ids.has(ws.active) ? ws.active : (open[0] ?? null) };
      }
    }
  } catch {
    // Corrupt or blocked storage: start fresh.
  }
  const files = defaultFiles(p);
  return { files, open: [files[0].id, files[1].id], active: files[0].id };
}

function FileIcon({ name, className }: { name: string; className?: string }) {
  const lang = langFor(name);
  const Icon = lang === "sql" ? Database : lang === "r" ? Sigma : lang === "markdown" || lang === "text" ? FileText : FileCode;
  const color = lang === "python" ? "text-[#8fe3da]" : lang === "sql" ? "text-[#a9b8ff]" : lang === "r" ? "text-[#e9c48a]" : "text-[#9fc3be]";
  return <Icon className={cn("size-4 shrink-0", color, className)} aria-hidden />;
}

/* ------------------------------------------------------------- component */

export function EnclaveIde(props: EnclaveIdeProps) {
  const { projectId, analyses, kMin, poolCount, dataTypes } = props;
  const router = useRouter();

  const [ws, setWs] = useState<Workspace>(() => loadWorkspace(props));
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    { kind: "dim", text: "Enclave kernel ready. Press Run or Ctrl+Enter." },
  ]);
  const [running, setRunning] = useState(false);
  const [panelTab, setPanelTab] = useState<"console" | "problems">("console");
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [openTables, setOpenTables] = useState<Record<string, boolean>>({ donors: true, labs: true });

  const taRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const escapedRef = useRef(false);
  const cancelRef = useRef(false);
  const mountedRef = useRef(true);
  const wsRef = useRef(ws);

  const active = ws.files.find((f) => f.id === ws.active) ?? null;
  const lang: Lang = active ? langFor(active.name) : "text";
  const ctxBase = useMemo(() => ({ lang, approved: analyses }), [lang, analyses]);
  const problems = useMemo(() => (active ? analyze(active.content, ctxBase) : []), [active, ctxBase]);
  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warnCount = problems.length - errorCount;
  const problemLines = useMemo(() => {
    const m = new Map<number, "error" | "warning">();
    for (const p of problems) if (m.get(p.line) !== "error") m.set(p.line, p.severity);
    return m;
  }, [problems]);

  const lines = useMemo(() => (active ? active.content.split("\n") : [""]), [active]);
  const highlighted = useMemo(() => lines.map((l) => tokenizeLine(l, lang)), [lines, lang]);

  /* --------------------------------------------------------- persistence */

  const persist = useCallback(
    (next: Workspace) => {
      try {
        window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
        setSavedAt(new Date());
        setDirty(false);
        return true;
      } catch {
        toast.error("Couldn't save. This browser's storage may be full or blocked.");
        return false;
      }
    },
    [projectId],
  );

  // Autosave shortly after edits stop.
  useEffect(() => {
    wsRef.current = ws;
    const t = setTimeout(() => persist(ws), 650);
    return () => clearTimeout(t);
  }, [ws, persist]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRef.current = true;
    };
  }, []);

  // Keep the console scrolled to the newest line.
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [consoleLines, panelTab]);

  function saveNow() {
    if (persist(wsRef.current)) toast.success("Saved to this browser.");
  }

  /* ------------------------------------------------------------- editing */

  function updateContent(content: string) {
    if (!active) return;
    setDirty(true);
    setWs((w) => ({ ...w, files: w.files.map((f) => (f.id === active.id ? { ...f, content } : f)) }));
  }

  function syncScroll() {
    const ta = taRef.current;
    if (!ta) return;
    if (layerRef.current) layerRef.current.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  function updateCursor() {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const line = before.split("\n").length;
    const col = before.length - before.lastIndexOf("\n");
    setCursor((c) => (c.line === line && c.col === col ? c : { line, col }));
  }

  /** Insert text at the selection, keeping the browser's native undo stack. */
  function insertText(text: string) {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const ok = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
    if (!ok) {
      const { selectionStart: s, selectionEnd: e, value } = ta;
      const next = value.slice(0, s) + text + value.slice(e);
      updateContent(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = s + text.length;
      });
    }
    updateCursor();
  }

  /** Replace whole lines touched by the selection (indent, outdent, comment). */
  function transformLines(fn: (lines: string[]) => string[]) {
    const ta = taRef.current;
    if (!ta) return;
    const { value, selectionStart, selectionEnd } = ta;
    const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
    let end = value.indexOf("\n", selectionEnd - (selectionEnd > selectionStart && value[selectionEnd - 1] === "\n" ? 1 : 0));
    if (end === -1) end = value.length;
    const block = value.slice(start, end);
    const next = fn(block.split("\n")).join("\n");
    ta.setSelectionRange(start, end);
    insertText(next);
    ta.setSelectionRange(start, start + next.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Escape") {
      escapedRef.current = true;
      return;
    }
    if (e.key === "Tab" && escapedRef.current) return; // let focus move on
    escapedRef.current = false;

    if (mod && e.key === "Enter") {
      e.preventDefault();
      void run();
      return;
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveNow();
      return;
    }
    if (mod && e.key === "/") {
      e.preventDefault();
      const mark = lang === "sql" ? "-- " : lang === "markdown" ? "<!-- " : "# ";
      transformLines((ls) => {
        const all = ls.filter((l) => l.trim()).every((l) => l.trimStart().startsWith(mark.trim()));
        return ls.map((l) => {
          if (!l.trim()) return l;
          if (all) return l.replace(new RegExp(`^(\\s*)${mark.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ?`), "$1");
          const indent = l.match(/^\s*/)![0];
          return indent + mark + l.slice(indent.length);
        });
      });
      return;
    }
    const ta = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes("\n");
      if (e.shiftKey) transformLines((ls) => ls.map((l) => l.replace(/^ {1,4}/, "")));
      else if (multi) transformLines((ls) => ls.map((l) => INDENT + l));
      else insertText(INDENT);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !mod) {
      e.preventDefault();
      const before = ta.value.slice(0, ta.selectionStart);
      const current = before.slice(before.lastIndexOf("\n") + 1);
      let indent = current.match(/^\s*/)![0];
      if (/[:{([]\s*$/.test(current) && lang !== "markdown") indent += INDENT;
      insertText(`\n${indent}`);
      return;
    }
    if (e.key === "Backspace" && ta.selectionStart === ta.selectionEnd) {
      const before = ta.value.slice(0, ta.selectionStart);
      const current = before.slice(before.lastIndexOf("\n") + 1);
      if (current.length > 0 && current.length % 4 === 0 && /^ +$/.test(current)) {
        e.preventDefault();
        ta.setSelectionRange(ta.selectionStart - 4, ta.selectionStart);
        insertText("");
      }
    }
  }

  /* ---------------------------------------------------------- file ops */

  function openFile(id: string) {
    setWs((w) => ({ ...w, open: w.open.includes(id) ? w.open : [...w.open, id], active: id }));
    setSidebarOpen(false);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function closeTab(id: string) {
    setWs((w) => {
      const idx = w.open.indexOf(id);
      const open = w.open.filter((o) => o !== id);
      const active = w.active === id ? (open[idx] ?? open[idx - 1] ?? null) : w.active;
      return { ...w, open, active };
    });
  }

  function validName(name: string, exceptId?: string): string | null {
    if (!FILE_NAME.test(name)) return "Use a name like model.py, query.sql, plot.R or notes.md.";
    if (ws.files.some((f) => f.id !== exceptId && f.name.toLowerCase() === name.toLowerCase())) return "A file with that name already exists.";
    return null;
  }

  function createFile(name: string) {
    const err = validName(name);
    if (err) {
      toast.error(err);
      return false;
    }
    const lng = langFor(name);
    const starter =
      lng === "python"
        ? "from trialcave import enclave\n\ncohort = enclave.cohort()\n"
        : lng === "sql"
          ? "SELECT age_band, COUNT(*) AS people\nFROM   donors\nGROUP  BY age_band;\n"
          : lng === "r"
            ? "library(trialcave)\n\ncohort <- enclave_cohort()\ncat(\"Donors:\", nrow(cohort))\n"
            : "";
    const f: IdeFile = { id: uid(), name, content: starter };
    setWs((w) => ({ files: [...w.files, f], open: [...w.open, f.id], active: f.id }));
    setCreating(false);
    requestAnimationFrame(() => taRef.current?.focus());
    return true;
  }

  function renameFile(id: string, name: string) {
    const err = validName(name, id);
    if (err) {
      toast.error(err);
      return false;
    }
    setWs((w) => ({ ...w, files: w.files.map((f) => (f.id === id ? { ...f, name } : f)) }));
    setRenaming(null);
    return true;
  }

  function deleteFile(id: string) {
    setWs((w) => {
      const files = w.files.filter((f) => f.id !== id);
      const open = w.open.filter((o) => o !== id);
      return { files, open, active: w.active === id ? (open[0] ?? null) : w.active };
    });
    setConfirmDelete(null);
  }

  function resetWorkspace() {
    const files = defaultFiles(props);
    setWs({ files, open: [files[0].id, files[1].id], active: files[0].id });
    setConfirmReset(false);
    setConsoleLines([{ kind: "dim", text: "Workspace reset to the examples." }]);
  }

  function insertSnippet(text: string) {
    if (!active) {
      toast.message("Open a file first.");
      return;
    }
    insertText(text);
  }

  /* ---------------------------------------------------------------- run */

  async function run() {
    if (running) {
      cancelRef.current = true;
      return;
    }
    if (!active) return;
    persist(wsRef.current);
    setPanelOpen(true);
    setPanelTab("console");
    setRunning(true);
    cancelRef.current = false;

    const ctx: KernelContext = { fileName: active.name, lang, poolCount, kMin, approved: analyses, dataTypes };
    const steps = plan(active.content, ctx);
    const push = (l: ConsoleLine | ConsoleLine[]) => setConsoleLines((c) => [...c, ...(Array.isArray(l) ? l : [l])].slice(-400));
    push({ kind: "dim", text: "" });
    let ranReal = false;

    for (const s of steps) {
      if (cancelRef.current) {
        if (mountedRef.current) push({ kind: "warn", text: "KeyboardInterrupt: run stopped. Nothing left the Enclave." });
        break;
      }
      await sleep(s.delay);
      if (!mountedRef.current) return;
      if (s.kind === "line") push(s.line);
      else if (s.kind === "blocked") logBlockedRawDownload(projectId).catch(() => {});
      else {
        const meta = analyses.find((a) => a.key === s.key);
        push({ kind: "info", text: `Running approved analysis "${meta?.label ?? s.key}" on the donor pool…` });
        try {
          const res = await runAnalysisAction(projectId, s.key as AnalysisKey);
          if (!mountedRef.current) return;
          if (!res.ok || !res.result) {
            push({ kind: "err", text: `EnclaveError: ${res.error ?? "the analysis failed."}` });
            continue;
          }
          ranReal = true;
          const r = res.result;
          const table = asciiTable(
            ["Group", "People", r.valueLabel],
            r.rows.map((row) => [row.band, row.suppressed ? `<${kMin}` : String(row.n ?? 0), row.value != null ? row.value.toLocaleString() : "—"]),
          );
          push(table.map((text) => ({ kind: "out" as const, text })));
          if (r.suppressedCells > 0) push({ kind: "warn", text: `${r.suppressedCells} group${r.suppressedCells > 1 ? "s" : ""} hidden (fewer than ${kMin} people).` });
          push({ kind: "ok", text: res.donorCount ? `Logged to run history. ${res.donorCount} donors included were credited.` : "Logged to run history. Every group was too small to show." });
        } catch {
          if (mountedRef.current) push({ kind: "err", text: "EnclaveError: lost connection to the kernel. Try again." });
        }
      }
    }
    if (!mountedRef.current) return;
    setRunning(false);
    if (ranReal) router.refresh();
  }

  /* -------------------------------------------------------------- render */

  const kernelState = running ? "running" : errorCount ? "error" : "ready";
  const canSnippet = lang === "python" || lang === "r";

  return (
    <section
      aria-label="Enclave code editor"
      className="on-dark relative flex h-[clamp(560px,80vh,860px)] flex-col overflow-hidden rounded-[24px] border border-[#1f4440] bg-[#0b1f1d] text-[#d7e7e4] shadow-[0_40px_80px_-40px_rgba(13,38,36,.7)]"
    >
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1f4440] bg-[#0d2624] px-3 sm:px-4">
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-expanded={sidebarOpen}
          aria-label="Show files"
          className="inline-flex size-10 items-center justify-center rounded-lg text-[#9fc3be] hover:bg-white/5 md:hidden"
        >
          <PanelLeft className="size-5" aria-hidden />
        </button>
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#153634]">
          <Lock className="size-4 text-[#8fe3da]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.95rem] font-extrabold leading-tight text-white">Enclave IDE</p>
          <p className="hidden truncate text-[0.78rem] leading-tight text-[#7fa39e] sm:block">Sandboxed · aggregates only · k ≥ {kMin}</p>
        </div>
        <span
          className={cn(
            "ml-1 hidden items-center gap-2 rounded-full border px-3 py-1 text-[0.78rem] font-bold sm:inline-flex",
            kernelState === "running" && "border-[#8fe3da]/40 bg-[#8fe3da]/10 text-[#8fe3da]",
            kernelState === "ready" && "border-[#2f5e5a] text-[#9fc3be]",
            kernelState === "error" && "border-[#f0a28a]/40 bg-[#f0a28a]/10 text-[#f0a28a]",
          )}
          role="status"
        >
          <span className={cn("size-2 rounded-full", kernelState === "running" ? "animate-pulse bg-[#8fe3da]" : kernelState === "error" ? "bg-[#f0a28a]" : "bg-[#5e9c63]")} />
          {kernelState === "running" ? "Running" : kernelState === "error" ? `${errorCount} problem${errorCount > 1 ? "s" : ""}` : "Kernel ready"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[0.8rem] text-[#7fa39e] lg:inline" aria-live="polite">
            {dirty ? "Saving…" : savedAt ? `Saved to this browser · ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Saved to this browser"}
          </span>
          <button
            type="button"
            onClick={saveNow}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2f5e5a] px-3 text-[0.9rem] font-bold text-[#d7e7e4] hover:border-[#8fe3da] hover:text-white"
            title="Save (Ctrl+S)"
          >
            <Save className="size-4" aria-hidden />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={!active}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[0.92rem] font-extrabold transition-colors disabled:opacity-50",
              running ? "bg-[#f0a28a] text-[#0d2624] hover:bg-[#f5b9a6]" : "bg-[#8fe3da] text-[#0d2624] hover:bg-[#b5efe8]",
            )}
            title={running ? "Stop" : "Run (Ctrl+Enter)"}
          >
            {running ? <Square className="size-4 fill-current" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
            {running ? "Stop" : "Run"}
            <kbd className="hidden rounded-md bg-[#0d2624]/15 px-1.5 py-0.5 text-[0.7rem] font-bold xl:inline">Ctrl ↵</kbd>
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex w-[260px] shrink-0 flex-col border-r border-[#1f4440] bg-[#0f2a27]",
            "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:shadow-2xl",
            sidebarOpen ? "max-md:flex" : "max-md:hidden",
          )}
          aria-label="Explorer"
        >
          <div className="min-h-0 flex-1 overflow-y-auto py-3 [scrollbar-color:#2f5e5a_transparent] [scrollbar-width:thin]">
            {/* Files */}
            <div className="flex items-center justify-between px-4 pb-1.5">
              <h3 className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[#7fa39e]">Files</h3>
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setRenaming(null);
                }}
                className="inline-flex size-7 items-center justify-center rounded-md text-[#9fc3be] hover:bg-white/5 hover:text-white"
                aria-label="New file"
                title="New file"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            <ul className="px-2">
              {creating ? (
                <li>
                  <NameInput
                    initial="untitled.py"
                    onSubmit={createFile}
                    onCancel={() => setCreating(false)}
                    label="New file name"
                  />
                </li>
              ) : null}
              {ws.files.map((f) => (
                <li key={f.id}>
                  {renaming === f.id ? (
                    <NameInput initial={f.name} onSubmit={(n) => renameFile(f.id, n)} onCancel={() => setRenaming(null)} label={`Rename ${f.name}`} />
                  ) : confirmDelete === f.id ? (
                    <div className="my-0.5 rounded-lg bg-[#f0a28a]/10 px-2.5 py-2 text-[0.85rem]" role="alertdialog" aria-label={`Delete ${f.name}?`}>
                      <p className="font-bold text-[#f0a28a]">Delete {f.name}?</p>
                      <div className="mt-1.5 flex gap-2">
                        <button type="button" onClick={() => deleteFile(f.id)} className="rounded-md bg-[#f0a28a] px-2.5 py-1 text-[0.8rem] font-bold text-[#0d2624]">
                          Delete
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-md px-2.5 py-1 text-[0.8rem] font-bold text-[#d7e7e4] hover:bg-white/5">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "group flex items-center rounded-lg",
                        ws.active === f.id ? "bg-[#8fe3da]/12 text-white" : "text-[#c3d7d4] hover:bg-white/5",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openFile(f.id)}
                        onDoubleClick={() => setRenaming(f.id)}
                        aria-current={ws.active === f.id ? "true" : undefined}
                        className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 px-2.5 text-left text-[0.9rem] font-medium"
                      >
                        <FileIcon name={f.name} />
                        <span className="truncate">{f.name}</span>
                      </button>
                      <span className="flex pr-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <button type="button" onClick={() => setRenaming(f.id)} className="inline-flex size-7 items-center justify-center rounded-md text-[#9fc3be] hover:text-white" aria-label={`Rename ${f.name}`}>
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(f.id)} className="inline-flex size-7 items-center justify-center rounded-md text-[#9fc3be] hover:text-[#f0a28a]" aria-label={`Delete ${f.name}`}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
              {ws.files.length === 0 && !creating ? <li className="px-2.5 py-2 text-[0.85rem] text-[#7fa39e]">No files. Add one with +.</li> : null}
            </ul>

            {/* Dataset */}
            <h3 className="mt-5 px-4 pb-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[#7fa39e]">Dataset</h3>
            <p className="px-4 pb-2 text-[0.78rem] leading-snug text-[#5f8a85]">Click a field to insert it.</p>
            <ul className="px-2">
              {SCHEMA.map((t) => {
                const allowed = !t.needs || dataTypes.includes(t.needs);
                const isOpen = allowed && openTables[t.table];
                return (
                  <li key={t.table}>
                    <button
                      type="button"
                      disabled={!allowed}
                      onClick={() => setOpenTables((o) => ({ ...o, [t.table]: !o[t.table] }))}
                      aria-expanded={allowed ? isOpen : undefined}
                      className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[0.88rem] font-semibold text-[#c3d7d4] hover:bg-white/5 disabled:cursor-not-allowed disabled:text-[#4f7470] disabled:hover:bg-transparent"
                      title={allowed ? undefined : "Not part of this project's approved data"}
                    >
                      {allowed ? isOpen ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                      <Table2 className="size-4 text-[#a9b8ff]" aria-hidden />
                      {t.table}
                    </button>
                    {isOpen ? (
                      <ul className="mb-1 ml-[22px] border-l border-[#1f4440] pl-2">
                        {t.fields.map((f) => (
                          <li key={f.name}>
                            <button
                              type="button"
                              onClick={() => insertSnippet(f.name)}
                              title={f.note ?? `Insert ${f.name}`}
                              className="flex min-h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left font-mono text-[0.8rem] text-[#d7e7e4] hover:bg-white/5"
                            >
                              <span className="truncate">{f.name}</span>
                              <span className="shrink-0 text-[0.72rem] text-[#5f8a85]">{f.type}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* Approved analyses */}
            <h3 className="mt-5 px-4 pb-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[#7fa39e]">Approved analyses</h3>
            <ul className="space-y-1 px-2">
              {analyses.length === 0 ? <li className="px-2 text-[0.82rem] text-[#5f8a85]">None approved yet.</li> : null}
              {analyses.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    disabled={!canSnippet}
                    onClick={() =>
                      insertSnippet(lang === "r" ? `result <- enclave_run("${a.key}")\nprint(result)\n` : `result = enclave.run("${a.key}")\nresult.show()\n`)
                    }
                    title={canSnippet ? "Insert a call to this analysis" : "Open a .py or .R file to insert"}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#e9c48a]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[0.84rem] font-semibold leading-snug text-[#d7e7e4]">{a.label}</span>
                      <span className="block truncate font-mono text-[0.72rem] text-[#5f8a85]">{a.key}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[#1f4440] p-2">
            {confirmReset ? (
              <div className="rounded-lg bg-[#f0a28a]/10 p-2.5 text-[0.82rem]" role="alertdialog" aria-label="Reset workspace?">
                <p className="font-bold text-[#f0a28a]">Replace all files with the examples?</p>
                <div className="mt-1.5 flex gap-2">
                  <button type="button" onClick={resetWorkspace} className="rounded-md bg-[#f0a28a] px-2.5 py-1 text-[0.8rem] font-bold text-[#0d2624]">
                    Reset
                  </button>
                  <button type="button" onClick={() => setConfirmReset(false)} className="rounded-md px-2.5 py-1 text-[0.8rem] font-bold hover:bg-white/5">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[0.84rem] font-semibold text-[#9fc3be] hover:bg-white/5 hover:text-white">
                <RotateCcw className="size-3.5" aria-hidden /> Reset to examples
              </button>
            )}
          </div>
        </aside>

        {/* Editor column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Tabs */}
          <div role="tablist" aria-label="Open files" className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-[#1f4440] bg-[#0d2624] [scrollbar-width:none]">
            {ws.open.map((id) => {
              const f = ws.files.find((x) => x.id === id);
              if (!f) return null;
              const on = ws.active === id;
              return (
                <div
                  key={id}
                  className={cn(
                    "group relative flex shrink-0 items-center border-r border-[#1f4440]",
                    on ? "bg-[#0b1f1d] text-white" : "text-[#9fc3be] hover:bg-white/[.03]",
                  )}
                >
                  {on ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[#8fe3da]" /> : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => openFile(id)}
                    className="flex h-full items-center gap-2 pl-3.5 pr-1.5 text-[0.86rem] font-semibold"
                  >
                    <FileIcon name={f.name} className="size-3.5" />
                    {f.name}
                    {on && dirty ? <span className="size-1.5 rounded-full bg-[#e9c48a]" aria-label="Unsaved" /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeTab(id)}
                    aria-label={`Close ${f.name}`}
                    className={cn("mr-1.5 inline-flex size-6 items-center justify-center rounded-md hover:bg-white/10", on ? "opacity-80" : "opacity-0 group-hover:opacity-80 focus-visible:opacity-100")}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Code */}
          {active ? (
            <div className="relative flex min-h-0 flex-1 font-mono text-[14px]" style={{ lineHeight: `${LINE_H}px` }}>
              <div className="relative w-14 shrink-0 select-none overflow-hidden border-r border-[#16332f] bg-[#0b1f1d] text-right text-[12.5px] text-[#4f7470]" aria-hidden>
                <div ref={gutterRef} style={{ paddingTop: PAD_Y, paddingBottom: PAD_Y }} className="will-change-transform">
                  {lines.map((_, i) => {
                    const p = problemLines.get(i + 1);
                    return (
                      <div key={i} style={{ height: LINE_H }} className={cn("relative pr-3", cursor.line === i + 1 && "text-[#c3d7d4]")}>
                        {p ? <span className={cn("absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full", p === "error" ? "bg-[#f0a28a]" : "bg-[#e9c48a]")} /> : null}
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div ref={layerRef} aria-hidden className="pointer-events-none absolute left-0 top-0 min-w-full will-change-transform" style={{ padding: `${PAD_Y}px 0` }}>
                  {highlighted.map((toks, i) => {
                    const p = problemLines.get(i + 1);
                    return (
                      <div
                        key={i}
                        style={{ height: LINE_H }}
                        className={cn(
                          "whitespace-pre px-[18px]",
                          cursor.line === i + 1 && "bg-[#8fe3da]/[.05]",
                          p === "error" && "bg-[#f0a28a]/[.07] underline decoration-[#f0a28a]/60 decoration-wavy underline-offset-4",
                          p === "warning" && "bg-[#e9c48a]/[.05]",
                        )}
                      >
                        {toks.map((tk, j) => (
                          <span key={j} className={TOKEN_CLASS[tk.t]}>
                            {tk.v}
                          </span>
                        ))}
                        {toks.length === 0 || (toks.length === 1 && toks[0].v === "") ? " " : null}
                      </div>
                    );
                  })}
                </div>
                <textarea
                  ref={taRef}
                  value={active.content}
                  onChange={(e) => {
                    updateContent(e.target.value);
                    updateCursor();
                  }}
                  onKeyDown={onKeyDown}
                  onKeyUp={updateCursor}
                  onClick={updateCursor}
                  onSelect={updateCursor}
                  onScroll={syncScroll}
                  wrap="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  aria-label={`Code editor for ${active.name}. Press Escape then Tab to leave the editor.`}
                  className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-[18px] text-transparent caret-[#8fe3da] outline-none selection:bg-[#8fe3da]/25 [scrollbar-color:#2f5e5a_transparent] [scrollbar-width:thin] [tab-size:4]"
                  style={{ paddingTop: PAD_Y, paddingBottom: PAD_Y, lineHeight: `${LINE_H}px` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <FileCode className="size-10 text-[#2f5e5a]" aria-hidden />
              <p className="text-[1rem] font-bold text-white">No file open</p>
              <p className="max-w-[22rem] text-[0.9rem] text-[#7fa39e]">Pick a file from the explorer, or create a new one.</p>
              <button type="button" onClick={() => setCreating(true)} className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-[#8fe3da] px-4 text-[0.9rem] font-extrabold text-[#0d2624]">
                <Plus className="size-4" aria-hidden /> New file
              </button>
            </div>
          )}

          {/* Bottom panel */}
          <div className={cn("flex shrink-0 flex-col border-t border-[#1f4440] bg-[#0a1a18]", panelOpen ? "h-[34%] min-h-[150px]" : "h-10")}>
            <div className="flex h-10 shrink-0 items-center gap-1 px-2" role="tablist" aria-label="Output">
              <PanelTab on={panelTab === "console" && panelOpen} onClick={() => { setPanelTab("console"); setPanelOpen(true); }}>
                <Terminal className="size-3.5" aria-hidden /> Console
              </PanelTab>
              <PanelTab on={panelTab === "problems" && panelOpen} onClick={() => { setPanelTab("problems"); setPanelOpen(true); }}>
                <CircleAlert className="size-3.5" aria-hidden /> Problems
                {problems.length ? (
                  <span className={cn("rounded-full px-1.5 text-[0.7rem] font-extrabold", errorCount ? "bg-[#f0a28a] text-[#0d2624]" : "bg-[#e9c48a] text-[#0d2624]")}>{problems.length}</span>
                ) : null}
              </PanelTab>
              <div className="ml-auto flex items-center gap-1">
                {panelTab === "console" && panelOpen ? (
                  <button type="button" onClick={() => setConsoleLines([])} className="rounded-md px-2 py-1 text-[0.78rem] font-semibold text-[#7fa39e] hover:bg-white/5 hover:text-white">
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPanelOpen((o) => !o)}
                  aria-label={panelOpen ? "Hide output panel" : "Show output panel"}
                  aria-expanded={panelOpen}
                  className="inline-flex size-7 items-center justify-center rounded-md text-[#7fa39e] hover:bg-white/5 hover:text-white"
                >
                  <ChevronDown className={cn("size-4 transition-transform", !panelOpen && "rotate-180")} aria-hidden />
                </button>
              </div>
            </div>
            {panelOpen ? (
              panelTab === "console" ? (
                <div
                  ref={consoleRef}
                  className="min-h-0 flex-1 overflow-auto px-4 pb-3 font-mono text-[12.5px] leading-[19px] [scrollbar-color:#2f5e5a_transparent] [scrollbar-width:thin]"
                  role="log"
                  aria-live="polite"
                  aria-label="Console output"
                >
                  {consoleLines.map((l, i) => (
                    <div key={i} className={cn("whitespace-pre", CONSOLE_CLASS[l.kind])}>
                      {l.text || " "}
                    </div>
                  ))}
                  {running ? <span className="inline-block h-[15px] w-2 animate-pulse bg-[#8fe3da]/70 align-middle" aria-hidden /> : null}
                </div>
              ) : (
                <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2 text-[0.86rem]">
                  {problems.length === 0 ? <li className="px-2 py-1 text-[#7fa39e]">No problems in {active?.name ?? "this file"}.</li> : null}
                  {problems.map((p, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => jumpToLine(p.line)}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
                      >
                        {p.severity === "error" ? <CircleX className="mt-0.5 size-4 shrink-0 text-[#f0a28a]" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#e9c48a]" aria-hidden />}
                        <span className="text-[#d7e7e4]">{p.message}</span>
                        <span className="ml-auto shrink-0 font-mono text-[0.78rem] text-[#5f8a85]">Ln {p.line}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-[#1f4440] bg-[#153634] px-3 font-mono text-[11.5px] text-[#9fc3be]">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-[#8fe3da]" : "bg-[#5e9c63]")} aria-hidden />
          Enclave kernel · {RUNTIME[lang]}
        </span>
        <button type="button" onClick={() => { setPanelTab("problems"); setPanelOpen(true); }} className="flex items-center gap-2 whitespace-nowrap hover:text-white">
          <span className="flex items-center gap-1"><CircleX className="size-3" aria-hidden />{errorCount}</span>
          <span className="flex items-center gap-1"><CircleAlert className="size-3" aria-hidden />{warnCount}</span>
          <span className="sr-only">problems</span>
        </button>
        <span className="hidden whitespace-nowrap sm:inline">{poolCount} donors</span>
        <span className="ml-auto whitespace-nowrap">Ln {cursor.line}, Col {cursor.col}</span>
        <span className="hidden whitespace-nowrap sm:inline">Spaces: 4</span>
        <span className="hidden whitespace-nowrap md:inline">UTF-8</span>
        <span className="whitespace-nowrap">{LANG_LABEL[lang]}</span>
      </div>
    </section>
  );

  function jumpToLine(line: number) {
    const ta = taRef.current;
    if (!ta) return;
    const parts = ta.value.split("\n");
    const start = parts.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(start, start + (parts[line - 1]?.length ?? 0));
    ta.scrollTop = Math.max(0, (line - 4) * LINE_H);
    syncScroll();
    updateCursor();
  }
}

/* ------------------------------------------------------------ helpers */

function PanelTab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-bold uppercase tracking-[0.06em]",
        on ? "bg-white/[.06] text-white" : "text-[#7fa39e] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function NameInput({
  initial,
  onSubmit,
  onCancel,
  label,
}: {
  initial: string;
  onSubmit: (name: string) => boolean;
  onCancel: () => void;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  // Enter submits and unmounts this input; ignore the blur that can follow.
  const done = useRef(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (onSubmit(value.trim())) done.current = true;
      }}
      className="my-0.5"
    >
      <input
        autoFocus
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          const dot = e.target.value.lastIndexOf(".");
          e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            done.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (done.current) return;
          if (!value.trim() || value.trim() === initial) onCancel();
          else if (!onSubmit(value.trim())) onCancel();
        }}
        className="h-9 w-full rounded-lg border border-[#8fe3da] bg-[#0b1f1d] px-2.5 font-mono text-[0.85rem] text-white outline-none"
      />
    </form>
  );
}
