"use client";

import { useEffect, useRef } from "react";

// Deterministic layout so server and client render the same SVG.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const VAULT = { x: 210, y: 90, w: 210, h: 280 };

const DONORS = (() => {
  const rand = rng(11);
  const out: { x: number; y: number; sx: number; sy: number }[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 5; c++) {
      const x = VAULT.x + 40 + c * 32;
      const y = VAULT.y + 70 + r * 32;
      const sx = 30 + rand() * 130;
      const sy = 70 + rand() * 320;
      out.push({ x, y, sx, sy });
    }
  }
  return out;
})();

/** Donor dots travel into the Enclave; only group-level bars come out. */
export function EnclaveFigure() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("run");
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      className="enclave-fig"
      viewBox="0 0 625 460"
      role="img"
      aria-label="Donor records move into the Enclave. Only group results, never individual records, come out."
    >
      <text x="95" y="48" textAnchor="middle" fill="#c3d7d4" fontSize="17" fontWeight="700">
        Donors
      </text>
      {DONORS.map((d, i) => (
        <circle key={`g${i}`} className="ghost" cx={d.sx} cy={d.sy} r="7" />
      ))}

      <rect x={VAULT.x} y={VAULT.y} width={VAULT.w} height={VAULT.h} rx="28" fill="#153634" stroke="#2f5e5a" strokeWidth="2" />
      <text x={VAULT.x + VAULT.w / 2} y={VAULT.y + 40} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">
        The Enclave
      </text>
      <g transform={`translate(${VAULT.x + VAULT.w / 2 - 11} ${VAULT.y - 34})`} fill="none" stroke="#8fe3da" strokeWidth="3" strokeLinecap="round">
        <rect x="0" y="12" width="22" height="18" rx="4" fill="#0d2624" />
        <path d="M5 12V7a6 6 0 0 1 12 0v5" />
      </g>
      {DONORS.map((d, i) => (
        <circle
          key={`d${i}`}
          className="donor"
          cx={d.x}
          cy={d.y}
          r="7"
          style={{ ["--dx" as string]: `${d.sx - d.x}px`, ["--dy" as string]: `${d.sy - d.y}px` } as React.CSSProperties}
        />
      ))}

      <g className="later">
        <path d="M432 230h40" stroke="#8fe3da" strokeWidth="3" strokeLinecap="round" />
        <path d="M466 222l10 8-10 8" fill="none" stroke="#8fe3da" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="535" y="140" textAnchor="middle" fill="#c3d7d4" fontSize="17" fontWeight="700">
          Group results
        </text>
        <line x1="490" y1="320" x2="580" y2="320" stroke="#2f5e5a" strokeWidth="2" />
      </g>
      <g>
        <rect className="bar" x="496" y="230" width="20" height="90" rx="4" />
        <rect className="bar" x="526" y="190" width="20" height="130" rx="4" />
        <rect className="bar" x="556" y="260" width="20" height="60" rx="4" />
      </g>
      <text className="later" x="535" y="352" textAnchor="middle" fill="#8fe3da" fontSize="15" fontWeight="700">
        Never groups under 10
      </text>
    </svg>
  );
}
