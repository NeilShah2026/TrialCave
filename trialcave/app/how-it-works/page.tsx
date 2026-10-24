import Link from "next/link";
import { Check, FileText, Handshake, Layers, ScanLine, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "How it works" };

const PROMISES = [
  { title: "Your data", body: "See everything TrialCave holds, download a copy, correct it, or delete it anytime." },
  { title: "Your choice", body: "Nothing is used without your consent. You choose which research your donation supports, and you approve every clinic that contacts you." },
  { title: "Your paycheck", body: "When your donation powers research, you're compensated, and you can see which kinds of studies it supported." },
];

const NEVER = [
  "Never sell or hand over your data",
  "Never let clinics browse profiles",
  "Never show a clinic who declined",
  "Never collect precise location or genetic data",
  "Never pay for radiation scans",
  "Never decide trial eligibility — the study team does",
];

const LAYERS = [
  ["Consent filter", "Only Donors who allowed that data type and research type are included."],
  ["De-identification", "No names, contact details, towns, or exact dates go into an analysis."],
  ["Approved analyses only", "Researchers pick from predefined analyses approved for their project."],
  ["Small-group hiding", "Any group under 10 people is hidden from every result."],
  ["Aggregate export only", "Only group tables can leave. Raw-record download is disabled and logged."],
  ["Audit trail", "Every run and export is recorded."],
];

const CONSENT = [
  "Turn clinic invitations on or off, and pick which conditions, in Settings.",
  "Choose each data type and research type for your donation. Everything starts off.",
  "Every choice you make is recorded with the exact text you agreed to.",
  "Download, correct, or delete your data, or withdraw from research, from Privacy controls.",
];

const H2 = "text-[clamp(1.6rem,2.6vw,2.2rem)] font-extrabold tracking-[-0.02em]";
const BAND = "px-[clamp(16px,4vw,72px)] py-[clamp(40px,7vh,80px)]";
const INNER = "mx-auto max-w-[1100px]";
const BODY = "mt-4 max-w-[46rem] text-[1.1rem] leading-relaxed text-tc-ink-2";

function SectionIcon({ icon: Icon }: { icon: typeof FileText }) {
  return (
    <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-tc-primary-soft text-tc-primary-ink">
      <Icon className="size-6" aria-hidden />
    </span>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="flex-1">
      <SiteHeader />
      <PageHero
        tone="night"
        kicker="How it works"
        title="How TrialCave works"
        lede={
          <>
            Your <span className="font-bold text-tc-mint">data</span>, your{" "}
            <span className="font-bold text-tc-mint">choice</span>, your{" "}
            <span className="font-bold text-tc-mint">paycheck</span>.
          </>
        }
      />

      {/* Promises */}
      <section className={`${BAND} bg-white`} aria-labelledby="promises-heading">
        <div className={INNER}>
          <h2 id="promises-heading" className="sr-only">Our three promises</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {PROMISES.map((p, i) => (
              <Card key={p.title} className="border-tc-border bg-tc-mist p-7 shadow-none">
                <p className="text-[1rem] font-bold text-tc-primary-ink">0{i + 1}</p>
                <h3 className="mt-1 text-[1.35rem] font-extrabold">{p.title}</h3>
                <p className="mt-2 text-[1.05rem] leading-relaxed text-tc-ink-2">{p.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Records + two-way */}
      <section className={`${BAND} bg-tc-mist`}>
        <div className={`${INNER} grid gap-10 md:grid-cols-2`}>
          <div>
            <SectionIcon icon={FileText} />
            <h2 className={H2}>Your records become your profile</h2>
            <p className={BODY}>
              Take photos of your paperwork, upload a file, or enter results by hand. We read each
              document and show you every item with the exact line it came from. Nothing is used
              until you confirm it. Then we check your profile against recruiting trials, one
              criterion at a time, and explain every result in plain language.
            </p>
          </div>
          <div>
            <SectionIcon icon={Handshake} />
            <h2 className={H2}>Two-way, always on your terms</h2>
            <p className={BODY}>
              Clinics can only reach you if you meet their study&apos;s criteria. They see a count,
              never a name, until you approve — and you pick exactly which fields to share.
            </p>
          </div>
        </div>
      </section>

      {/* Enclave */}
      <section
        id="enclave"
        className={`on-dark relative scroll-mt-24 overflow-hidden bg-tc-night text-white ${BAND}`}
        aria-labelledby="enclave-heading"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(95,169,162,.55) 1.2px, transparent 1.4px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className={`relative ${INNER}`}>
          <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-tc-night-2 text-tc-mint">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <h2 id="enclave-heading" className={H2}>How the Enclave works</h2>
          <p className="mt-4 max-w-[46rem] text-[1.1rem] leading-relaxed text-tc-night-text">
            Data Donors contribute de-identified data to research. It stays inside the Enclave.
            Researchers run approved analyses there and only ever take out aggregate results —
            group averages with small groups hidden. No one downloads individual records, and
            research partners pay for the analysis, not for your data. Donors collect a paycheck
            when their donation powers a study.
          </p>
          <p className="mt-4 max-w-[46rem] text-[1.1rem] leading-relaxed text-tc-night-text">
            Paychecks only ever come from data with real provenance — connected devices and
            documents on file. Typed-in answers help you find trials but never earn money, so
            there&apos;s no reason to fake data.
          </p>

          <h3 className="mt-10 flex items-center gap-2 text-[1.15rem] font-bold">
            <Layers className="size-5 text-tc-mint" aria-hidden /> Enclave protection layers
          </h3>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-tc-night-line">
            <table className="w-full min-w-[480px] text-left text-[1.05rem]">
              <caption className="sr-only">How the Enclave protects Donors</caption>
              <thead className="bg-tc-night-2">
                <tr>
                  <th scope="col" className="px-5 py-3 font-bold text-tc-mint">Layer</th>
                  <th scope="col" className="px-5 py-3 font-bold text-tc-mint">What it does</th>
                </tr>
              </thead>
              <tbody>
                {LAYERS.map(([l, d]) => (
                  <tr key={l} className="border-t border-tc-night-line">
                    <th scope="row" className="px-5 py-4 align-top font-bold text-white">{l}</th>
                    <td className="px-5 py-4 text-tc-night-text">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Consent + scans */}
      <section className={`${BAND} bg-white`}>
        <div className={`${INNER} grid gap-10 md:grid-cols-2`}>
          <div>
            <SectionIcon icon={SlidersHorizontal} />
            <h2 className={H2}>Your consent controls</h2>
            <ul className="mt-5 space-y-3">
              {CONSENT.map((c) => (
                <li key={c} className="flex items-start gap-3 text-[1.05rem] leading-relaxed text-tc-ink-2">
                  <Check className="mt-1 size-5 shrink-0 text-tc-primary" strokeWidth={3} aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionIcon icon={ScanLine} />
            <h2 className={H2}>Scans and imaging</h2>
            <p className={BODY}>
              You can donate scans you already have. We never offer compensation for scans that use
              radiation or contrast dye. Partner imaging is on our roadmap and will be limited to MRI,
              ultrasound, retinal photos, and skin photos, ordered under an IRB-approved protocol.
            </p>
          </div>
        </div>
      </section>

      {/* Never */}
      <section className={`${BAND} bg-tc-mist`} aria-labelledby="never-heading">
        <div className={INNER}>
          <h2 id="never-heading" className={H2}>What we never do</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NEVER.map((n) => (
              <li
                key={n}
                className="flex items-start gap-3 rounded-2xl bg-white p-5 text-[1.05rem] font-semibold text-tc-ink shadow-card"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tc-danger-soft">
                  <X className="size-4 text-tc-danger-ink" strokeWidth={3} aria-hidden />
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className={`${BAND} bg-tc-primary-soft`}>
        <div className={`${INNER} flex flex-wrap items-center justify-between gap-6`}>
          <div className="max-w-[40rem]">
            <h2 className={H2}>Ready to find a study?</h2>
            <p className="mt-2 text-[1.1rem] text-tc-ink-2">
              Finding trials and applying are always free.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create an account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/trials">Find a trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
