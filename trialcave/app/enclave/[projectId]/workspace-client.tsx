"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runAnalysisAction, exportRunCsv, logBlockedRawDownload } from "../actions";
import type { AnalysisKey, AnalysisResult } from "@/lib/enclave/analyses";

export function WorkspaceClient({
  projectId,
  analyses,
}: {
  projectId: string;
  analyses: { key: AnalysisKey; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AnalysisKey>(analyses[0]?.key ?? "steps_by_hba1c");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  function run() {
    startTransition(async () => {
      const res = await runAnalysisAction(projectId, selected);
      if (!res.ok || !res.result) {
        toast.error(res.error ?? "Run failed.");
        return;
      }
      setResult(res.result);
      toast.success(`Ran over ${res.donorCount} donors.`);
    });
  }

  function exportCsv() {
    startTransition(async () => {
      // The run id isn't surfaced to the client; re-run export against the most
      // recent run by storing it server-side would be cleaner. For the demo we
      // reconstruct CSV from the in-memory result (aggregates only).
      if (!result) return;
      const header = "band,n,value";
      const lines = result.rows.map((r) => `${JSON.stringify(r.band)},${r.n},${r.value ?? ""}`);
      const csv = [header, ...lines].join("\n");
      const link = document.createElement("a");
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      link.download = `enclave-${selected}.csv`;
      link.click();
      void exportRunCsv; // server-side export + audit available for real runs
    });
  }

  function blockedRawDownload() {
    void logBlockedRawDownload(projectId);
    toast.message("Raw records never leave the Enclave.");
  }

  const chartData = result?.rows.filter((r) => r.value != null).map((r) => ({ band: r.band, value: r.value as number })) ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-primary bg-tc-primary-soft">
        <CardContent className="pt-6">
          <p className="font-medium">You are working inside the TrialCave Enclave.</p>
          <p className="text-sm text-muted-foreground">Individual records never leave this environment.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as AnalysisKey)}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            >
              {analyses.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <Button onClick={run} disabled={pending}>{pending ? "Running…" : "Run"}</Button>
          </div>

          {result ? (
            <div className="mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Band</th>
                    <th className="py-2">n</th>
                    <th className="py-2">{result.valueLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.band} className="border-b border-border">
                      <td className="py-2">{r.band}</td>
                      <td className="py-2">{r.suppressed ? "<10" : r.n}</td>
                      <td className="py-2">{r.value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {chartData.length > 0 ? (
                <div className="mt-4 h-64">
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
                  {result.suppressedCells} group{result.suppressedCells > 1 ? "s" : ""} hidden (fewer than 10 people).
                </p>
              ) : null}

              <div className="mt-4 flex items-center gap-3">
                <Button variant="outline" onClick={exportCsv}>Export results (CSV)</Button>
                <span className="inline-block">
                  <Button variant="ghost" disabled onClick={blockedRawDownload} title="Raw records never leave the Enclave">
                    Download raw records
                  </Button>
                </span>
                <button type="button" onClick={blockedRawDownload} className="text-xs text-muted-foreground underline">
                  Why is this disabled?
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Pick an analysis and run it to see aggregate results.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
