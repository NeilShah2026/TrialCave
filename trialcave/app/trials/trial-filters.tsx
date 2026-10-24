"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_OPTIONS } from "@/lib/categories";

const SELECT =
  "min-h-[3.1rem] w-full rounded-[14px] border-2 border-input bg-white px-3 text-[1.05rem] text-tc-ink focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft";

export function TrialFilters({ towns }: { towns: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const town = params.get("town") ?? "";

  function update(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    router.push(`/trials?${sp.toString()}`);
  }

  return (
    <form
      role="search"
      className="grid gap-3 rounded-[24px] bg-white p-4 text-tc-ink shadow-card sm:p-5 md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        update({ q: typeof q === "string" ? q.trim() : "" });
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-[0.95rem] font-bold">Condition or keyword</span>
        <Input name="q" defaultValue={query} placeholder="For example, diabetes or insulin" />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[0.95rem] font-bold">Area</span>
        <select key={category} defaultValue={category} onChange={(e) => update({ category: e.target.value })} className={SELECT}>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-[0.95rem] font-bold">Your town</span>
        <select key={town} defaultValue={town} onChange={(e) => update({ town: e.target.value })} className={SELECT}>
          <option value="">Anywhere in MA</option>
          {towns.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit">
        <Search aria-hidden /> Search
      </Button>
    </form>
  );
}
