"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Code2, Download, ListChecks, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runAnalysisAction, exportRunCsv, logBlockedRawDownload } from "../actions";
import type { AnalysisKey, AnalysisResult } from "@/lib/enclave/analyses";

// The IDE keeps files in localStorage, so it only renders in the browser.
const EnclaveIde = dynamic(() => import("./ide/enclave-ide").then((m) => m.EnclaveIde), {
  ssr: false,
  loading: () => (
    <div className="flex h-[clamp(560px,80vh,860px)] items-center justify-center rounded-[24px] border border-[#1f4440] bg-[#0b1f1d] text-[#9fc3be]" role="status">
      <Loader2 className="mr-2 size-5 animate-spin text-tc-mint" aria-hidden /> Starting the Enclave kernel…
    </div>
  ),
});

interface WorkspaceProps {
  projectId: string;
  projectTitle: string;
  analyses: { key: AnalysisKey; label: string }[];
  kMin: number;
  poolCount: number;
  dataTypes: string[];
}

/** Enclave workspace: a code editor plus the one-click approved analyses. */
export function WorkspaceClient(props: WorkspaceProps) {
  return (
    <div className="space-y-5">
      <div className="on-dark flex gap-4 rounded-[24px] border border-tc-night-line bg-tc-night px-6 py-5 text-white">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tc-night-2">
          <Lock className="size-5 text-tc-mint" aria-hidden />
        </span>
        <div>
          <p className="text-[1.1rem] font-bold">You are working inside the TrialCave Enclave.</p>
          <p className="text-[1rem] text-tc-night-text">Individual records never leave this environment. Only group results of {props.kMin}+ people can.</p>
        </div>
      </div>

      <Tabs defaultValue="code">
        <TabsList aria-label="Workspace mode">
          <TabsTrigger value="code" className="gap-2">
            <Code2 className="size-4" aria-hidden /> Code editor
          </TabsTrigger>
          <TabsTrigger value="quick" className="gap-2">
            <ListChecks className="size-4" aria-hidden /> Approved analyses
          </TabsTrigger>
        </TabsList>
        <TabsContent value="code">
          <EnclaveIde {...props} />
        </TabsContent>
        <TabsContent value="quick">
          <QuickRun projectId={props.projectId} analyses={props.analyses} kMin={props.kMin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickRun({
  projectId,
  analyses,
  kMin,
}: {
  projectId: string;
  analyses: { key: AnalysisKey; label: string }[];
  kMin: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AnalysisKey | undefined>(analyses[0]?.key);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  function run() {
    if (!selected) return;
    startTransition(async () => {
      try {
        const res = await runAnalysisAction(projectId, selected);
        if (!res.ok || !res.result) {
          toast.error(res.error ?? "Run failed.");
          return;
        }
        setResult(res.result);
        setRunId(res.runId ?? null);
        toast.success(res.donorCount ? "Analysis complete. Donors included were credited." : "Analysis complete. Every group was too small to show.");
        router.refresh();
      } catch {
        toast.error("Run failed. Try again.");
      }
    });
  }

  function exportCsv() {
    if (!runId) return;
    startTransition(async () => {
      try {
        const res = await exportRunCsv(runId);
        if (!res.ok || !res.csv) {
          toast.error(res.error ?? "Export failed.");
          return;
        }
        const link = document.createElement("a");
        link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(res.csv)}`;
        link.download = res.fileName ?? "enclave-results.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Exported the aggregate table.");
      } catch {
        toast.error("Export failed. Try again.");
      }
    });
  }

  function blockedRawDownload() {
    logBlockedRawDownload(projectId).catch(() => {});
    toast.message("Raw records never leave the Enclave. This attempt was logged.");
  }

  const chartData = result?.rows.filter((r) => r.value != null).map((r) => ({ band: r.band, value: r.value as number })) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 sm:p-8">
          {analyses.length === 0 ? (
            <p className="text-[1.05rem] text-tc-ink-2">No analyses are approved for this project yet.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1 space-y-1.5 sm:max-w-[28rem]">
                <Label htmlFor="analysis">Analysis</Label>
                <select
                  id="analysis"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value as AnalysisKey)}
                  className="min-h-[3.1rem] w-full rounded-[14px] border-2 border-input bg-white px-3 text-[1.05rem] text-tc-ink focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
                >
                  {analyses.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>
              <Button onClick={run} disabled={pending || !selected}>{pending ? "Running…" : "Run analysis"}</Button>
            </div>
          )}

          {result ? (
            <div className="mt-8 space-y-5">
              <div className="overflow-x-auto rounded-2xl border border-tc-border">
                <table className="w-full">
                  <caption className="sr-only">Aggregate results</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">Group</th>
                      <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">People</th>
                      <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">{result.valueLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.band} className="[&:last-child>*]:border-0">
                        <th scope="row" className="border-b border-tc-border px-4 py-3 text-left text-[1rem] font-semibold">{r.band}</th>
                        <td className="border-b border-tc-border px-4 py-3 text-[1rem]">
                          {r.suppressed ? <span className="font-semibold text-tc-warning-ink">{`<${kMin}`}</span> : r.n}
                        </td>
                        <td className="border-b border-tc-border px-4 py-3 text-[1rem]">{r.value != null ? r.value.toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {chartData.length > 0 ? (
                <div className="h-72 rounded-2xl bg-tc-mist p-4" role="img" aria-label={`Bar chart of ${result.valueLabel} by group`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d6dedd" />
                      <XAxis dataKey="band" fontSize={14} />
                      <YAxis fontSize={14} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2F7D7A" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              {result.suppressedCells > 0 ? (
                <p className="rounded-2xl bg-tc-warning-soft px-5 py-4 font-semibold text-tc-warning-ink">
                  {result.suppressedCells} group{result.suppressedCells > 1 ? "s" : ""} hidden (fewer than {kMin} people).
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={exportCsv} disabled={pending || !runId}>
                  <Download aria-hidden /> Export results (CSV)
                </Button>
                {/* The button is disabled; the wrapper catches the click so it can be logged (B14.5). */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={blockedRawDownload}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") blockedRawDownload();
                  }}
                  title="Raw records never leave the Enclave"
                  aria-label="Download raw records (disabled). Raw records never leave the Enclave."
                  className="inline-block cursor-not-allowed rounded-[14px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
                >
                  <Button variant="ghost" disabled tabIndex={-1} className="pointer-events-none">
                    Download raw records
                  </Button>
                </span>
                <span className="text-[0.95rem] text-tc-muted">Raw records never leave the Enclave.</span>
              </div>
            </div>
          ) : analyses.length > 0 ? (
            <p className="mt-6 rounded-2xl bg-tc-mist p-5 text-[1.05rem] text-tc-ink-2">Pick an analysis and run it to see aggregate results.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
