"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DATA_TYPES, RESEARCH_TYPES } from "@/lib/patient-options";
import { updateResearchConsents, type ConsentCell } from "./actions";

const key = (d: string, r: string) => `${d}:${r}`;

/** Data type × research type grid. Used on the Donor page and the sign-up flow. */
export function ConsentTable({
  grid,
  onToggle,
  disabled,
}: {
  grid: Record<string, boolean>;
  onToggle: (dataType: string, researchType: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-tc-border">
      <table className="w-full min-w-[420px] text-[1rem] text-tc-ink">
        <caption className="sr-only">Which research each kind of data may support</caption>
        <thead>
          <tr className="bg-tc-mist">
            <th scope="col" className="px-4 py-3 text-left font-bold">Data</th>
            {RESEARCH_TYPES.map((r) => (
              <th key={r.value} scope="col" className="px-3 py-3 text-center font-bold">{r.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DATA_TYPES.map((d) => (
            <tr key={d.value} className="border-t border-tc-border">
              <th scope="row" className="px-4 py-3 text-left font-semibold">{d.label}</th>
              {RESEARCH_TYPES.map((r) => (
                <td key={r.value} className="px-3 py-3 text-center">
                  <Checkbox
                    checked={Boolean(grid[key(d.value, r.value)])}
                    onCheckedChange={() => onToggle(d.value, r.value)}
                    disabled={disabled}
                    aria-label={`Allow ${d.label.toLowerCase()} for ${r.label.toLowerCase()} research`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConsentGrid({ initial }: { initial: ConsentCell[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialGrid = Object.fromEntries(initial.map((c) => [key(c.dataType, c.researchType), c.allowed]));
  const [grid, setGrid] = useState<Record<string, boolean>>(initialGrid);
  const dirty = DATA_TYPES.some((d) =>
    RESEARCH_TYPES.some((r) => Boolean(grid[key(d.value, r.value)]) !== Boolean(initialGrid[key(d.value, r.value)])),
  );

  const toggle = (d: string, r: string) => setGrid((g) => ({ ...g, [key(d, r)]: !g[key(d, r)] }));

  function save() {
    const cells: ConsentCell[] = [];
    for (const d of DATA_TYPES) for (const r of RESEARCH_TYPES) cells.push({ dataType: d.value, researchType: r.value, allowed: Boolean(grid[key(d.value, r.value)]) });
    startTransition(async () => {
      try {
        const res = await updateResearchConsents(cells);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't save.");
          return;
        }
        toast.success("Saved. Changes apply to future analyses.");
        router.refresh();
      } catch {
        toast.error("Couldn't save. Try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6 sm:pt-7">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">What you allow</h2>
        <p className="mt-1 text-[1.05rem] text-tc-ink-2">
          Choose which research your donation supports. Changes apply to future analyses only.
        </p>
        <div className="mt-4">
          <ConsentTable grid={grid} onToggle={toggle} disabled={pending} />
        </div>
        <Button className="mt-4" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save choices"}
        </Button>
      </CardContent>
    </Card>
  );
}
