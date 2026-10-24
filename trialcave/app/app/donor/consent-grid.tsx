"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { updateResearchConsents, type ConsentCell } from "./actions";

const DATA_TYPES = ["wearables", "labs", "imaging", "history"];
const RESEARCH_TYPES = ["academic", "pharma", "ai", "device"];

export function ConsentGrid({ initial }: { initial: ConsentCell[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [grid, setGrid] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.map((c) => [`${c.dataType}:${c.researchType}`, c.allowed])),
  );

  const key = (d: string, r: string) => `${d}:${r}`;
  const toggle = (d: string, r: string) => setGrid((g) => ({ ...g, [key(d, r)]: !g[key(d, r)] }));

  function save() {
    const cells: ConsentCell[] = [];
    for (const d of DATA_TYPES) for (const r of RESEARCH_TYPES) cells.push({ dataType: d, researchType: r, allowed: Boolean(grid[key(d, r)]) });
    startTransition(async () => {
      const res = await updateResearchConsents(cells);
      if (res.ok) {
        toast.success("Changes apply to future analyses.");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">What you allow</h2>
        <p className="text-sm text-muted-foreground">Choose which research your donation supports. Changes apply to future analyses only.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr><th className="p-2 text-left">Data</th>{RESEARCH_TYPES.map((r) => <th key={r} className="p-2 capitalize">{r}</th>)}</tr>
            </thead>
            <tbody>
              {DATA_TYPES.map((d) => (
                <tr key={d}>
                  <td className="p-2 capitalize">{d}</td>
                  {RESEARCH_TYPES.map((r) => (
                    <td key={r} className="p-2 text-center">
                      <Checkbox checked={Boolean(grid[key(d, r)])} onCheckedChange={() => toggle(d, r)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button className="mt-4" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save consent"}</Button>
      </CardContent>
    </Card>
  );
}
