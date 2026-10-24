"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { runAnalysisAction, exportRunCsv, logBlockedRawDownload } from "../actions";
import type { AnalysisKey, AnalysisResult } from "@/lib/enclave/analyses";

export function WorkspaceClient({
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
      <Card className="border-primary bg-tc-primary-soft">
        <CardContent className="flex gap-3 pt-6">
          <Lock className="mt-0.5 size-5 text-primary" aria-hidden />
          <div>
            <p className="font-medium">You are working inside the TrialCave Enclave.</p>
            <p className="text-sm text-muted-foreground">Individual records never leave this environment.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No analyses are approved for this project yet.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="analysis">Analysis</Label>
                <select
                  id="analysis"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value as AnalysisKey)}
                  className="h-10 rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {analyses.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </div>
              <Button onClick={run} disabled={pending || !selected}>{pending ? "Running…" : "Run analysis"}</Button>
            </div>
          )}

          {result ? (
            <div className="mt-6">
              <table className="w-full text-sm">
                <caption className="sr-only">Aggregate results</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-2">Group</th>
                    <th scope="col" className="py-2">People</th>
                    <th scope="col" className="py-2">{result.valueLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.band} className="border-b border-border">
                      <th scope="row" className="py-2 text-left font-normal">{r.band}</th>
                      <td className="py-2">{r.suppressed ? `<${kMin}` : r.n}</td>
                      <td className="py-2">{r.value != null ? r.value.toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {chartData.length > 0 ? (
                <div className="mt-4 h-64" role="img" aria-label={`Bar chart of ${result.valueLabel} by group`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EC" />
                      <XAxis dataKey="band" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2F7D7A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              {result.suppressedCells > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {result.suppressedCells} group{result.suppressedCells > 1 ? "s" : ""} hidden (fewer than {kMin} people).
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
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
                  className="inline-block cursor-not-allowed rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Button variant="ghost" disabled tabIndex={-1} className="pointer-events-none">
                    Download raw records
                  </Button>
                </span>
                <span className="text-xs text-muted-foreground">Raw records never leave the Enclave.</span>
              </div>
            </div>
          ) : analyses.length > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Pick an analysis and run it to see aggregate results.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
