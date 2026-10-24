"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleHelp, FileText, MapPin, Search, Upload } from "lucide-react";

const STEPS = [
  {
    title: "She searched for studies near Worcester",
    body: "Maria typed her condition and town. 41 studies came up, each with questions she couldn't answer from memory.",
  },
  {
    title: "She uploaded her visit summary",
    body: "A PDF from her last appointment, or a photo of the printout. TrialCave read it for her.",
  },
  {
    title: "She confirmed what we found",
    body: "Each item showed the line it came from. Nothing was used until she said yes.",
  },
  {
    title: "She saw her matches, with reasons",
    body: "Every study was checked one requirement at a time, with the record behind each answer.",
  },
];

/** Pinned, scroll-driven example (desktop). On tablet and phone all four scenes stack. */
export function MariaStory({ startHref }: { startHref: string }) {
  const ref = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const span = el.offsetHeight - window.innerHeight;
      if (span <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / span));
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;
      setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function goTo(i: number) {
    const el = ref.current;
    if (!el) return;
    const span = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: "smooth" });
  }

  return (
    <section ref={ref} id="how" className="story" aria-labelledby="story-title">
      <div className="story-pin">
        <div className="wrap story-grid">
          <div>
            <p className="who">
              <span className="avatar" aria-hidden>
                M
              </span>
              An example: Maria, 54, Worcester
            </p>
            <h2 id="story-title" className="seg-title">
              From &ldquo;I don&apos;t know if I qualify&rdquo; to a short list, in one evening.
            </h2>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    className={`step-btn${step === i ? " active" : ""}`}
                    aria-current={step === i ? "step" : undefined}
                    onClick={() => goTo(i)}
                  >
                    <span className="step-num">{i + 1}</span>
                    <span>
                      <span className="st">{s.title}</span>
                      <span className="sd">{s.body}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="story-cta">
              <Link href={startHref} className="btn btn-primary">
                Try it with your records
              </Link>
              <small>Free. Takes about 10 minutes.</small>
            </div>
          </div>

          <div className="stage">
            <Scene i={0} step={step}>
              <p className="panel-kicker">Search</p>
              <div className="searchbar">
                <Search aria-hidden /> Type 2 diabetes · Worcester
              </div>
              <div className="results">
                {[
                  ["Weekly insulin for adults with type 2 diabetes", "UMass Memorial, 3 miles", "4 questions"],
                  ["Diet and activity coaching study", "Worcester, 5 miles", "6 questions"],
                  ["New oral medicine for blood sugar", "Shrewsbury, 7 miles", "3 questions"],
                ].map(([t, m, q]) => (
                  <div key={t} className="result">
                    <span className="t">{t}</span>
                    <span className="m">
                      <MapPin aria-hidden /> {m}
                    </span>
                    <span className="q">{q}</span>
                  </div>
                ))}
              </div>
              <p className="more">+ 38 more studies</p>
            </Scene>

            <Scene i={1} step={step}>
              <p className="panel-kicker">Add records</p>
              <h4>Upload a visit summary or a photo</h4>
              <div className="upload-box">
                <Upload aria-hidden />
                Drop a PDF or photos here
              </div>
              <div className="attach">
                <FileText className="i" aria-hidden /> visit-summary-march.pdf
              </div>
              <p className="reading">
                Reading your record…
                <span>Found 6 items. You&apos;ll confirm each one.</span>
              </p>
            </Scene>

            <Scene i={2} step={step}>
              <p className="panel-kicker">Confirm</p>
              <h4>Is this right?</h4>
              <div className="found">
                <div className="found-row hl">
                  <div>
                    <span className="tag">Lab result</span>
                    <p className="what">A1C 7.9%</p>
                    <p className="src">From: &ldquo;Hemoglobin A1c 7.9 (H)&rdquo;, page 2</p>
                  </div>
                  <span className="confirm done">Confirmed</span>
                </div>
                <div className="found-row">
                  <div>
                    <span className="tag">Medication</span>
                    <p className="what">Metformin 1000 mg</p>
                    <p className="src">From: &ldquo;metformin 1000mg BID&rdquo;, page 1</p>
                  </div>
                  <span className="confirm">Confirm</span>
                </div>
              </div>
            </Scene>

            <Scene i={3} step={step}>
              <p className="panel-kicker">Your matches</p>
              <div className="sumrow">
                <span className="pill pill-yes">3 likely a fit</span>
                <span className="pill pill-maybe">5 need answers</span>
                <span className="pill pill-no">33 not a fit</span>
              </div>
              <div className="match-card">
                <div className="match-top">
                  <div>
                    <p className="t">Weekly insulin for adults with type 2 diabetes</p>
                    <p className="m">UMass Memorial · 3 miles</p>
                  </div>
                  <span className="pill pill-yes">Likely a fit</span>
                </div>
                <ul className="crit">
                  <li className="hl">
                    <CheckCircle2 aria-hidden />
                    <div>
                      <p className="crit-title">A1C between 7% and 10%</p>
                      <p className="crit-why">Yours is 7.9%, from your March visit summary</p>
                    </div>
                  </li>
                  <li>
                    <CheckCircle2 aria-hidden />
                    <div>
                      <p className="crit-title">Age 18 to 75</p>
                      <p className="crit-why">You&apos;re 54</p>
                    </div>
                  </li>
                  <li className="unk">
                    <CircleHelp aria-hidden />
                    <div>
                      <p className="crit-title">No insulin in the last 3 months</p>
                      <p className="crit-why">Not in your records. One quick question.</p>
                    </div>
                  </li>
                </ul>
                <p className="fine">The study team makes the final decision.</p>
              </div>
            </Scene>
          </div>
        </div>
      </div>
      <div className="story-progress" aria-hidden>
        <div ref={barRef} />
      </div>
    </section>
  );
}

function Scene({ i, step, children }: { i: number; step: number; children: React.ReactNode }) {
  return (
    <div className={`scene${step === i ? " active" : ""}`}>
      <div className="panel">
        <p className="scene-step">
          <span className="step-num">{i + 1}</span>
          {STEPS[i].title}
        </p>
        {children}
      </div>
    </div>
  );
}
