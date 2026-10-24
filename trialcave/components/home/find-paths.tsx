"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, MapPin, Search, Stethoscope } from "lucide-react";

const COMMON = ["Type 2 diabetes", "Breast cancer", "Asthma", "Depression", "High blood pressure", "Long COVID"];

/** Homepage "two ways to start": a plain search and the record-based check. */
export function FindPaths({
  towns,
  eligibilityHref,
  trialCount,
}: {
  towns: string[];
  eligibilityHref: string;
  trialCount: number;
}) {
  const [condition, setCondition] = useState("");

  return (
    <div className="paths">
      <form className="path" action="/trials" method="get" role="search" aria-labelledby="path-search-title">
        <div className="path-head">
          <span className="path-icon" aria-hidden>
            <Search />
          </span>
          <div>
            <h3 id="path-search-title">Search studies</h3>
            <p className="path-sub">Look through {trialCount > 0 ? `${trialCount.toLocaleString("en-US")} recruiting studies` : "every recruiting study"}. No account needed.</p>
          </div>
        </div>
        <div className="path-body">
          <div className="fields-2">
            <div className="field">
              <label htmlFor="home-q">Condition or keyword</label>
              <div className="input">
                <Stethoscope className="i" aria-hidden />
                <input
                  id="home-q"
                  name="q"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="For example, asthma"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="home-town">Your town</label>
              <div className="input">
                <MapPin className="i" aria-hidden />
                <input id="home-town" name="town" list="home-towns" placeholder="For example, Worcester" autoComplete="address-level2" />
                <datalist id="home-towns">
                  {towns.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
          <div className="chips" role="group" aria-label="Common conditions">
            <span className="chips-label">Common:</span>
            {COMMON.map((c) => (
              <button
                key={c}
                type="button"
                className="chip-btn"
                aria-pressed={condition === c}
                onClick={() => setCondition((cur) => (cur === c ? "" : c))}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="path-foot">
          <button type="submit" className="btn btn-primary btn-block">
            <Search className="i" aria-hidden /> Show studies
          </button>
        </div>
      </form>

      <div className="path path-elig on-dark">
        <div className="path-head">
          <span className="path-icon" aria-hidden>
            <ClipboardCheck />
          </span>
          <div>
            <h3>
              Check your eligibility <span className="hbadge">Free</span>
            </h3>
            <p className="path-sub">Upload a visit summary or a photo of your records. We check every study, one requirement at a time.</p>
          </div>
        </div>
        <div className="path-body">
          <div className="tally" aria-label="Example result">
            <p className="tally-cap">Example: 41 studies near Worcester</p>
            <div className="tally-row">
              <i style={{ background: "var(--sage)" }} aria-hidden />
              <span>Likely a fit</span>
              <b>3</b>
            </div>
            <div className="tally-row">
              <i style={{ background: "var(--amber)" }} aria-hidden />
              <span>Need one or two answers</span>
              <b>5</b>
            </div>
            <div className="tally-row">
              <i style={{ background: "#c0614f" }} aria-hidden />
              <span>Not a fit, with the reason</span>
              <b>33</b>
            </div>
          </div>
        </div>
        <div className="path-foot">
          <Link href={eligibilityHref} className="btn btn-mint btn-block">
            Check my eligibility
          </Link>
        </div>
      </div>
    </div>
  );
}
