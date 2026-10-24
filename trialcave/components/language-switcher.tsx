"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { setLanguage } from "@/app/app/language-actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ current }: { current: Language }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(lang: Language) {
    if (lang === current) return;
    startTransition(async () => {
      try {
        const res = await setLanguage(lang);
        if (!res.ok) {
          toast.error("Couldn't change the language.");
          return;
        }
        router.refresh();
      } catch {
        toast.error("Couldn't change the language.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Language">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => choose(l.code)}
          disabled={pending}
          aria-pressed={current === l.code}
          className={cn(
            "min-h-11 rounded-full border-2 px-4 text-[0.95rem] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft disabled:opacity-60",
            current === l.code
              ? "border-tc-primary bg-tc-primary text-white"
              : "border-tc-border bg-white text-tc-ink hover:border-tc-primary",
          )}
        >
          {l.nativeLabel}
        </button>
      ))}
    </div>
  );
}
