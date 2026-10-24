"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_OPTIONS } from "@/lib/categories";

export function TrialFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "all";

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
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        update({ q: typeof q === "string" ? q : "" });
      }}
    >
      <Input
        name="q"
        defaultValue={query}
        placeholder="Search trials (e.g. diabetes, insulin, cancer)"
        className="sm:max-w-sm"
        aria-label="Search trials"
      />
      <select
        defaultValue={category}
        onChange={(e) => update({ category: e.target.value })}
        aria-label="Condition"
        className="h-10 rounded-md border border-border bg-card px-3 text-sm"
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  );
}
