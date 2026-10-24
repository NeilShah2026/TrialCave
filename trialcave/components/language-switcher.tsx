"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { setLanguage } from "@/app/app/language-actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ current }: { current: Language }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(lang: Language) {
    if (lang === current) return;
    startTransition(async () => {
      await setLanguage(lang);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Language">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => choose(l.code)}
          disabled={pending}
          aria-pressed={current === l.code}
          className={cn(
            "rounded-md border px-2 py-1 text-xs transition-colors",
            current === l.code ? "border-primary bg-tc-primary-soft text-primary" : "border-border hover:bg-muted",
          )}
        >
          {l.nativeLabel}
        </button>
      ))}
    </div>
  );
}
