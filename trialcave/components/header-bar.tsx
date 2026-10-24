"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Globe, Menu, X } from "lucide-react";

import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { setSiteLanguage } from "@/app/actions";
import { cn } from "@/lib/utils";

export interface HeaderLink {
  href: string;
  label: string;
  /** Match only the exact path (section roots like /app). */
  exact?: boolean;
}

/**
 * Site header (design v3). "home" starts transparent over the night hero,
 * turns night once you scroll, then white after the hero. "solid" is always
 * white. Includes the language menu and a phone menu.
 */
export function HeaderBar({
  variant = "solid",
  brandHref = "/",
  links,
  lang,
  account,
  roleLabel,
}: {
  variant?: "home" | "solid";
  brandHref?: string;
  links: HeaderLink[];
  lang: Language;
  /** Signed-in user: show their email + sign out. Otherwise log in / sign up. */
  account: { email: string; homeHref: string; inArea: boolean } | null;
  roleLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(variant === "solid");
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const langRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the current tab visible in the small-screen tab strip.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>("[data-active]");
    if (!strip || !tab) return;
    strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
  }, [pathname]);

  useEffect(() => {
    if (variant !== "home") return;
    const hero = document.getElementById("hero");
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setPastHero(hero ? hero.getBoundingClientRect().bottom < 90 : window.scrollY > window.innerHeight - 90);
    };
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [variant]);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setLangOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [langOpen]);

  // Crowded navs (the patient area has 7 links) tighten up so they still fit at 1024px.
  const many = links.length > 4;
  // Signed-in role areas: always show tabs (row on laptops, strip below on small screens).
  const area = !!account?.inArea;
  const solid = variant === "solid" || pastHero;
  const night = !solid && scrolled;
  const dark = !solid; // white text over the hero / night bar

  function chooseLang(code: Language) {
    setLangOpen(false);
    if (code === lang) return;
    startTransition(async () => {
      await setSiteLanguage(code);
      router.refresh();
    });
  }

  const isActive = (l: HeaderLink) => {
    if (l.href.startsWith("#") || l.href.includes("#")) return false;
    return l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
  };
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="sticky top-0 z-50 print:hidden">
      <header
        className={cn(
          "relative h-20 w-full transition-[background-color,color,box-shadow] duration-200",
          solid && "bg-white text-tc-ink shadow-[0_1px_0_var(--tc-border)]",
          night && "bg-tc-night text-white shadow-[0_1px_0_var(--tc-night-line)]",
          !solid && !night && "bg-transparent text-white",
          dark && "on-dark",
        )}
      >
        <div className="mx-auto flex h-full max-w-[1464px] items-center gap-[clamp(16px,2.2vw,40px)] px-[clamp(20px,4vw,72px)]">
          <div className="flex shrink-0 items-center gap-3.5">
            <Brand href={brandHref} tone={dark ? "light" : "dark"} />
            {roleLabel ? (
              <span
                title={roleLabel}
                className={cn(
                  "hidden max-w-[13rem] truncate whitespace-nowrap rounded-full px-3 py-1 text-[0.85rem] font-bold 2xl:inline-block",
                  !many && "md:inline-block",
                  dark ? "bg-tc-night-2 text-tc-mint" : "bg-tc-primary-soft text-tc-primary-ink",
                )}
              >
                {roleLabel}
              </span>
            ) : null}
          </div>

          <span aria-hidden className="hidden h-8 w-px shrink-0 bg-current opacity-15 lg:block" />

          <nav
            aria-label="Main"
            className={cn(
              "hidden items-center lg:flex",
              many ? "gap-[clamp(14px,1.45vw,32px)]" : "gap-[clamp(18px,1.9vw,34px)]",
            )}
          >
            {links.map((l) => {
              const active = isActive(l);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-md py-2 font-semibold underline-offset-[6px] hover:underline",
                    many ? "text-[0.98rem] xl:text-[1.02rem]" : "text-[1.02rem]",
                    active ? (dark ? "text-tc-mint underline decoration-2" : "text-tc-primary-ink underline decoration-2") : "opacity-95",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen((o) => !o)}
                aria-expanded={langOpen}
                aria-controls="lang-menu"
                disabled={pending}
                className="inline-flex min-h-12 items-center gap-2 rounded-[10px] px-3 text-[1rem] font-semibold hover:bg-[rgba(127,127,127,.14)]"
              >
                <Globe className="size-[22px]" aria-hidden />
                <span className={cn("hidden", many ? "2xl:inline" : "sm:inline")}>{current.nativeLabel}</span>
                <ChevronDown className="size-[18px]" aria-hidden />
                <span className="sr-only">Change language</span>
              </button>
              {langOpen ? (
                <div id="lang-menu" className="absolute right-0 top-[54px] z-50 min-w-[220px] rounded-[14px] bg-white p-2 text-tc-ink shadow-pop">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      lang={l.code}
                      aria-current={l.code === lang ? "true" : undefined}
                      onClick={() => chooseLang(l.code)}
                      className={cn("block w-full rounded-[10px] px-3.5 py-3 text-left text-[1.05rem] hover:bg-tc-primary-soft", l.code === lang && "bg-tc-primary-soft font-bold")}
                    >
                      {l.nativeLabel}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {account ? (
              <div className={cn("items-center gap-4", area ? "flex" : "hidden lg:flex")}>
                <span className={cn("hidden max-w-[16rem] truncate text-[0.95rem] 2xl:inline", dark ? "text-tc-night-text" : "text-tc-muted")}>{account.email}</span>
                {!account.inArea ? (
                  <Link href={account.homeHref} className={cn("inline-flex min-h-12 items-center rounded-xl px-5 text-[1rem] font-bold", dark ? "bg-white text-tc-ink" : "bg-tc-primary text-white hover:bg-tc-primary-ink")}>
                    My account
                  </Link>
                ) : null}
                <SignOutButton tone={dark ? "light" : "dark"} compact={area} />
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Link href="/login" className="whitespace-nowrap rounded-[10px] px-3.5 py-3 text-[1.02rem] font-bold hover:bg-[rgba(127,127,127,.14)]">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className={cn("inline-flex min-h-12 items-center whitespace-nowrap rounded-xl px-5 text-[1rem] font-bold", solid ? "bg-tc-primary text-white hover:bg-tc-primary-ink" : "bg-white text-tc-ink hover:bg-tc-mint")}
                >
                  Sign up free
                </Link>
              </div>
            )}

            {/* Signed-in areas use the tab strip below instead of a dropdown. */}
            {!area ? (
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-current px-4 text-[1rem] font-bold lg:hidden"
              >
                {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
                Menu
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {area ? (
        <nav
          aria-label="Sections"
          className="border-b border-tc-border bg-white shadow-[0_1px_0_var(--tc-border)] lg:hidden"
        >
          <div ref={stripRef} className="flex gap-1.5 overflow-x-auto px-[clamp(12px,3vw,40px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {links.map((l) => {
              const active = isActive(l);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  data-active={active || undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[0.98rem] font-bold transition-colors",
                    active ? "bg-tc-primary text-white" : "text-tc-ink-2 hover:bg-tc-mist hover:text-tc-ink",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {menuOpen && !area ? (
        <nav
          id="mobile-menu"
          aria-label="Menu"
          className="absolute inset-x-0 top-full z-40 max-h-[calc(100vh-5rem)] overflow-y-auto bg-white px-[clamp(20px,4vw,72px)] pb-7 pt-3 text-tc-ink shadow-[0_30px_40px_-20px_rgba(0,0,0,.3)] lg:hidden"
        >
          {roleLabel ? <p className="pb-1 pt-2 text-[0.95rem] font-bold text-tc-primary-ink">{roleLabel}</p> : null}
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="flex min-h-[60px] items-center border-b border-tc-border text-[1.3rem] font-bold">
              {l.label}
            </Link>
          ))}
          {account ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!account.inArea ? (
                <Link href={account.homeHref} className="inline-flex min-h-[3.1rem] flex-1 items-center justify-center rounded-[14px] bg-tc-primary px-6 font-bold text-white">
                  My account
                </Link>
              ) : null}
              <SignOutButton />
              <span className="w-full text-[0.95rem] text-tc-muted">{account.email}</span>
            </div>
          ) : (
            <>
              <Link href="/login" className="flex min-h-[60px] items-center border-b border-tc-border text-[1.3rem] font-bold">
                Log in
              </Link>
              <Link href="/signup" className="mt-4 flex min-h-[3.4rem] w-full items-center justify-center rounded-[14px] bg-tc-primary text-[1.1rem] font-bold text-white">
                Sign up free
              </Link>
            </>
          )}
        </nav>
      ) : null}
    </div>
  );
}
