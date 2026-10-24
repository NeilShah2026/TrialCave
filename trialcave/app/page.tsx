import Link from "next/link";
import { ArrowDown, Check, CircleCheck, Lock } from "lucide-react";

import "./home.css";
import { SiteHeader } from "@/components/site-header";
import { EnclaveFigure } from "@/components/home/enclave-figure";
import { FindPaths } from "@/components/home/find-paths";
import { HeroMap } from "@/components/home/hero-map";
import { InviteDemo } from "@/components/home/invite-demo";
import { MariaStory } from "@/components/home/maria-story";
import { RevealObserver } from "@/components/home/reveal-observer";
import { getSessionUser } from "@/lib/auth";
import { TOWN_NAMES } from "@/lib/geo/towns";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/types";

async function recruitingCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("trials")
      .select("id", { count: "exact", head: true })
      .eq("source", "ctgov")
      .eq("is_demo", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

const PROMISES = [
  {
    n: "1.",
    title: "Your data.",
    body: "It's yours. See everything TrialCave holds, download a copy, correct it, or delete it anytime.",
    link: { href: "/app/privacy", label: "See your privacy controls" },
  },
  {
    n: "2.",
    title: "Your choice.",
    body: "Nothing is used without your consent. You approve every clinic that contacts you, and you pick what they see.",
    link: { href: "/how-it-works", label: "How matching works" },
  },
  {
    n: "3.",
    title: "Your paycheck.",
    body: "Donate your data if you want to. When it powers research, you're compensated, and you see which kinds of studies it supported.",
    link: { href: "#donate", label: "About data donation" },
  },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [{ deleted }, user, count] = await Promise.all([
    searchParams,
    getSessionUser().catch(() => null),
    recruitingCount(),
  ]);
  const patient = user?.role === "patient";
  const startHref = patient ? "/app" : user ? ROLE_HOME[user.role] : "/signup";
  const eligibilityHref = patient ? "/app/records" : "/signup";
  const donorHref = patient ? "/app/donor" : "/signup?path=donor";

  return (
    <main className="tc-home intro flex-1">
      <SiteHeader variant="home" />
      <RevealObserver />

      {/* 1. Opening screen */}
      <section id="hero" className="hero on-dark" aria-labelledby="hero-title">
        <HeroMap />
        <div className="wrap">
          <div className="hero-copy">
            <h1 id="hero-title">Find a clinical trial that fits you.</h1>
            <p className="tagline">
              <span>Your data.</span>
              <span>Your choice.</span>
              <span>Your paycheck.</span>
            </p>
            <p className="hero-sub">
              {count > 0 ? `${count.toLocaleString("en-US")} recruiting studies` : "Recruiting studies"} across
              Massachusetts, checked against your own records. Free for patients.
            </p>
            <div className="hero-actions">
              <Link href="#find" className="btn btn-light">
                Find a trial
              </Link>
              <Link href="#how" className="btn btn-ghost-light">
                See an example
              </Link>
            </div>
          </div>
        </div>
        <a href="#find" className="scroll-cue">
          <ArrowDown aria-hidden /> Scroll to start
        </a>
      </section>

      {deleted ? (
        <p role="status" className="wrap" style={{ padding: "16px var(--gutter)", background: "var(--teal-soft)", fontWeight: 700 }}>
          Your account was deleted. Thank you for trying TrialCave.
        </p>
      ) : null}

      {/* 2. For patients */}
      <section id="find" className="seg patients" aria-labelledby="find-title">
        <div className="wrap">
          <div className="find-head">
            <h2 id="find-title" className="seg-title">
              Two ways to start. Both are free.
            </h2>
            <p className="seg-lede">
              Browse on your own, or let TrialCave read your records and tell you where you likely fit, and why.
            </p>
          </div>
          <FindPaths towns={TOWN_NAMES} eligibilityHref={eligibilityHref} trialCount={count} />
        </div>
      </section>

      {/* 3. Maria's example */}
      <MariaStory startHref={startHref} />

      {/* 4. You decide */}
      <section className="seg decide" aria-labelledby="decide-title">
        <div className="wrap decide-grid">
          <div className="reveal">
            <h2 id="decide-title" className="seg-title">
              You decide who can contact you.
            </h2>
            <p className="seg-lede">
              Clinics can only invite you if you meet their study&apos;s criteria and you&apos;ve turned invitations on.
              You pick exactly what they see, and you can mute any clinic.
            </p>
            <div className="clinic-sees">
              <span className="num">No</span>
              <p>
                names reach a clinic before you say yes. <b>They see a count, never you.</b>
              </p>
            </div>
          </div>
          <InviteDemo />
        </div>
      </section>

      {/* 5. Promises */}
      <section className="seg" aria-label="Our promises">
        <div className="wrap">
          <ol className="promise-list">
            {PROMISES.map((p) => (
              <li key={p.title} className="promise reveal">
                <h2>
                  <span className="n">{p.n}</span> {p.title}
                </h2>
                <div>
                  <p>{p.body}</p>
                  <Link href={p.link.href}>{p.link.label} →</Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Data donation */}
      <section id="donate" className="seg on-dark" aria-labelledby="donate-title">
        <div className="wrap donate-grid">
          <div>
            <h2 id="donate-title" className="seg-title">
              Donate your data. Collect a paycheck when it powers research.
            </h2>
            <p className="optional">
              <CircleCheck className="i" aria-hidden /> Optional. Matching works the same either way.
            </p>
            <ul className="donate-facts">
              <li>
                <Lock className="i" aria-hidden />
                <span>
                  <b>De-identified first.</b> Names, addresses and exact dates are removed before anything enters the Enclave.
                </span>
              </li>
              <li>
                <Check className="i" aria-hidden />
                <span>
                  <b>Nothing leaves.</b> Researchers run approved analyses inside. Only group results come out, never groups
                  under 10 people.
                </span>
              </li>
              <li>
                <Check className="i" aria-hidden />
                <span>
                  <b>You choose the research.</b> Pick which kinds of studies your data can support. Change it anytime.
                </span>
              </li>
              <li>
                <Check className="i" aria-hidden />
                <span>
                  <b>Compensated when it&apos;s used.</b> You see which kinds of studies your donation supported.
                </span>
              </li>
            </ul>
            <div className="donate-actions">
              <Link href={donorHref} className="btn btn-mint">
                Become a Data Donor
              </Link>
              <Link href="/legal/donor-agreement" className="text-link">
                Read the donor agreement
              </Link>
            </div>
          </div>
          <EnclaveFigure />
        </div>
      </section>

      {/* 7. Clinics */}
      <section id="clinics" className="seg clinics" aria-labelledby="clinics-title">
        <div className="wrap">
          <div className="inner reveal">
            <p className="for">For research clinics</p>
            <h2 id="clinics-title" className="seg-title">
              Reach people who already fit your study.
            </h2>
            <p className="seg-lede">
              See how many people near your site meet your criteria, send IRB-approved invitations, and receive pre-screen
              reports with only the fields each person chooses to share.
            </p>
            <Link href={user?.role === "clinic" ? "/clinic" : "/signup?path=clinic"} className="btn btn-indigo">
              Reach pre-qualified participants
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
