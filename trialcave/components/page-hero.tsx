import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Top band for app and content pages (design v3). "night" echoes the homepage
 * hero; "mist" and "teal" are lighter versions for detail pages.
 */
export function PageHero({
  title,
  lede,
  kicker,
  back,
  actions,
  tone = "night",
  width = "wide",
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  kicker?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  tone?: "night" | "mist" | "teal" | "indigo";
  width?: "wide" | "narrow";
  children?: React.ReactNode;
}) {
  const dark = tone === "night";
  return (
    <section
      className={cn(
        "relative overflow-hidden px-[clamp(20px,4vw,72px)] pb-[clamp(32px,5.5vh,64px)] pt-[clamp(36px,6vh,68px)]",
        dark && "on-dark bg-tc-night text-white",
        tone === "mist" && "bg-tc-mist text-tc-ink",
        tone === "teal" && "bg-tc-primary-soft text-tc-ink",
        tone === "indigo" && "bg-tc-secondary-soft text-tc-ink",
      )}
    >
      {dark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(95,169,162,.55) 1.2px, transparent 1.4px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(100deg, transparent 35%, #000 85%)",
            WebkitMaskImage: "linear-gradient(100deg, transparent 35%, #000 85%)",
          }}
        />
      ) : null}
      <div className={cn("relative mx-auto", width === "wide" ? "max-w-[1320px]" : "max-w-[920px]")}>
        {back ? (
          <Link
            href={back.href}
            className={cn("mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-[1rem] font-bold hover:underline", dark ? "text-tc-mint" : "text-tc-primary-ink")}
          >
            <ArrowLeft className="size-5" aria-hidden /> {back.label}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-[46rem]">
            {kicker ? <p className={cn("mb-3 text-[1rem] font-bold", dark ? "text-tc-mint" : "text-tc-primary-ink")}>{kicker}</p> : null}
            <h1 className="text-[clamp(2rem,min(4vw,6.5vh),3.4rem)] font-extrabold leading-[1.06] tracking-[-0.025em]">{title}</h1>
            {lede ? <div className={cn("mt-3 text-[clamp(1.05rem,1.3vw,1.3rem)] leading-normal", dark ? "text-tc-night-text" : "text-tc-ink-2")}>{lede}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </section>
  );
}

/** Standard content container under a PageHero. */
export function PageBody({ children, width = "wide", className }: { children: React.ReactNode; width?: "wide" | "narrow"; className?: string }) {
  return (
    <div className={cn("mx-auto w-full px-[clamp(20px,4vw,72px)] py-[clamp(32px,5vh,60px)]", className)}>
      <div className={cn("mx-auto", width === "wide" ? "max-w-[1320px]" : "max-w-[920px]")}>{children}</div>
    </div>
  );
}
