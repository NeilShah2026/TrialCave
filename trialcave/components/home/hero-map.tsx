"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, ZoomIn } from "lucide-react";

/**
 * Massachusetts dot map behind the homepage hero.
 *
 * Everything eases with time-based exponential smoothing (no step changes):
 * the dots part around the cursor like a soft lens and drift back, the map
 * leans slightly toward the pointer, and resting near a city glides the
 * camera in. Respects prefers-reduced-motion and has a pause button.
 */

type LonLat = [number, number];

// Simplified state outline (lon, lat). Stylized, not survey-accurate.
const MAINLAND: LonLat[] = [
  [-73.508, 42.086], [-73.265, 42.746], [-72.458, 42.727], [-71.294, 42.697],
  [-71.13, 42.82], [-70.93, 42.885], [-70.82, 42.87], [-70.75, 42.68],
  [-70.6, 42.66], [-70.62, 42.56], [-70.86, 42.53], [-70.98, 42.42],
  [-70.93, 42.32], [-70.86, 42.27], [-70.72, 42.15], [-70.64, 42.0],
  [-70.53, 41.83], [-70.48, 41.77], [-70.25, 41.75], [-70.02, 41.79],
  [-70.03, 41.93], [-70.08, 42.03], [-70.19, 42.08], [-70.11, 42.07],
  [-69.98, 41.98], [-69.93, 41.8], [-69.95, 41.67], [-70.28, 41.63],
  [-70.48, 41.55], [-70.66, 41.53], [-70.65, 41.7], [-70.78, 41.73],
  [-70.93, 41.6], [-71.12, 41.49], [-71.2, 41.68], [-71.38, 41.88],
  [-71.38, 42.02], [-71.8, 42.01], [-72.8, 42.04], [-73.488, 42.05],
];
const VINEYARD: LonLat[] = [
  [-70.83, 41.35], [-70.64, 41.47], [-70.5, 41.44], [-70.45, 41.35], [-70.77, 41.31],
];
const NANTUCKET: LonLat[] = [
  [-70.24, 41.29], [-70.1, 41.31], [-69.96, 41.27], [-70.0, 41.24], [-70.21, 41.25],
];
const SHAPES = [MAINLAND, VINEYARD, NANTUCKET];

interface City {
  name: string;
  lon: number;
  lat: number;
}
const CITIES: City[] = [
  { name: "Boston", lon: -71.0589, lat: 42.3601 },
  { name: "Worcester", lon: -71.8023, lat: 42.2626 },
  { name: "Springfield", lon: -72.5898, lat: 42.1015 },
  { name: "Lowell", lon: -71.3162, lat: 42.6334 },
  { name: "Brockton", lon: -71.0184, lat: 42.0834 },
  { name: "New Bedford", lon: -70.9342, lat: 41.6362 },
  { name: "Pittsfield", lon: -73.2454, lat: 42.4501 },
  { name: "Hyannis", lon: -70.2962, lat: 41.6525 },
  { name: "Salem", lon: -70.8967, lat: 42.5195 },
  { name: "Framingham", lon: -71.4162, lat: 42.2793 },
];

const BOUNDS = { minLon: -73.55, maxLon: -69.9, minLat: 41.22, maxLat: 42.9 };
const LAT_SCALE = Math.cos((42 * Math.PI) / 180);

/** Smoothing time constants (ms). Bigger = softer. */
const TAU = {
  pointer: 60,
  presence: 280,
  dots: 160,
  zoom: 520,
  focus: 460,
  lean: 700,
};
const ZOOM_IN = 1.55;
const LENS_RADIUS = 120; // px
const LENS_PUSH = 20; // px
const LEAN = 0.018; // fraction of pointer offset the map leans toward

function inside(pt: LonLat, poly: LonLat[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Small deterministic PRNG so the dot field is stable between renders. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Dot {
  lon: number;
  lat: number;
  phase: number;
  near: boolean;
}

function buildDots(): Dot[] {
  const rand = rng(7);
  const dots: Dot[] = [];
  const stepLon = 0.045;
  const stepLat = stepLon * LAT_SCALE;
  for (let lat = BOUNDS.minLat; lat <= BOUNDS.maxLat; lat += stepLat) {
    for (let lon = BOUNDS.minLon; lon <= BOUNDS.maxLon; lon += stepLon) {
      const p: LonLat = [lon, lat];
      if (!SHAPES.some((s) => inside(p, s))) continue;
      const nearCity = CITIES.some((c) => Math.hypot((c.lon - lon) * LAT_SCALE, c.lat - lat) < 0.07);
      dots.push({ lon, lat, phase: rand() * Math.PI * 2, near: nearCity && rand() > 0.35 });
    }
  }
  return dots;
}

/** Frame-rate independent easing factor. */
const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

export function HeroMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const label = labelRef.current;
    const hero = canvas?.parentElement;
    if (!canvas || !label || !hero) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = buildDots();
    const n = dots.length;
    // Base (unzoomed) dot positions in CSS px, plus each dot's eased lens offset.
    const bx = new Float32Array(n);
    const by = new Float32Array(n);
    const ox = new Float32Array(n);
    const oy = new Float32Array(n);
    const glow = new Float32Array(n);
    const cityXY = CITIES.map(() => ({ x: 0, y: 0 }));

    let w = 0;
    let h = 0;
    let dpr = 1;
    let frame = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
    let dotR = 2;

    // Pointer: target (raw) and eased; presence fades the lens in and out.
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    let presence = 0;
    let presenceTarget = 0;
    // Camera: zoom around an eased focus point, plus a gentle lean.
    let zoom = 1;
    let zoomTarget = 1;
    let fx = 0;
    let fy = 0;
    let fxT = 0;
    let fyT = 0;
    let leanX = 0;
    let leanY = 0;
    let focusIdx = -1;

    let visible = true;
    let raf = 0;
    let last = 0;

    function layout() {
      const rect = hero!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      const lonSpan = (BOUNDS.maxLon - BOUNDS.minLon) * LAT_SCALE;
      const latSpan = BOUNDS.maxLat - BOUNDS.minLat;
      const box =
        w <= 720
          ? { x: 16, y: 85 + 8, w: w - 32, h: Math.min(w * 0.64, 270) }
          : w <= 1100
            ? { x: w * 0.3, y: h * 0.5, w: w * 0.68, h: h * 0.42 }
            : { x: w * 0.42, y: h * 0.14, w: w * 0.56, h: h * 0.72 };
      const scale = Math.min(box.w / lonSpan, box.h / latSpan);
      frame = {
        scale,
        w: lonSpan * scale,
        h: latSpan * scale,
        x: box.x + (box.w - lonSpan * scale) / 2,
        y: box.y + (box.h - latSpan * scale) / 2,
      };
      dotR = Math.max(1.4, scale * 0.012);
      for (let i = 0; i < n; i++) {
        bx[i] = frame.x + (dots[i].lon - BOUNDS.minLon) * LAT_SCALE * scale;
        by[i] = frame.y + (BOUNDS.maxLat - dots[i].lat) * scale;
      }
      CITIES.forEach((c, i) => {
        cityXY[i].x = frame.x + (c.lon - BOUNDS.minLon) * LAT_SCALE * scale;
        cityXY[i].y = frame.y + (BOUNDS.maxLat - c.lat) * scale;
      });
      if (focusIdx < 0) {
        fx = fxT = frame.x + frame.w / 2;
        fy = fyT = frame.y + frame.h / 2;
      }
    }

    // Base → screen (zoom around the focus point, then lean).
    const sx = (x: number) => fx + (x - fx) * zoom + leanX;
    const sy = (y: number) => fy + (y - fy) * zoom + leanY;

    /** Pick the city under the pointer, with hysteresis so it never flickers. */
    function updateFocus() {
      if (presenceTarget === 0) {
        zoomTarget = 1;
        label!.classList.remove("show");
        return;
      }
      // Pointer in base coordinates.
      const mx = fx + (tx - leanX - fx) / zoom;
      const my = fy + (ty - leanY - fy) / zoom;
      const reach = Math.max(34, frame.scale * 0.11);
      let best = -1;
      let bestD = Infinity;
      cityXY.forEach((c, i) => {
        const d = Math.hypot(c.x - mx, c.y - my);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const keep = focusIdx >= 0 && Math.hypot(cityXY[focusIdx].x - mx, cityXY[focusIdx].y - my) < reach * 1.8;
      if (keep) best = focusIdx;
      else if (bestD > reach) best = -1;

      if (best >= 0) {
        if (best !== focusIdx) {
          focusIdx = best;
          label!.textContent = `${CITIES[best].name} area`;
        }
        fxT = cityXY[best].x;
        fyT = cityXY[best].y;
        zoomTarget = ZOOM_IN;
        label!.classList.add("show");
      } else {
        zoomTarget = 1;
        label!.classList.remove("show");
      }
      const inMap = mx > frame.x - 20 && mx < frame.x + frame.w + 20 && my > frame.y - 20 && my < frame.y + frame.h + 20;
      hero!.classList.toggle("zoomable", inMap && best < 0);
    }

    function draw(t: number, dt: number) {
      const frozen = reduce || pausedRef.current;
      const kDots = reduce ? 1 : ease(dt, TAU.dots);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      // Soft spotlight under the cursor.
      if (presence > 0.01 && !reduce) {
        const g = ctx!.createRadialGradient(px, py, 0, px, py, LENS_RADIUS * 1.6);
        g.addColorStop(0, `rgba(143,227,218,${0.1 * presence})`);
        g.addColorStop(1, "rgba(143,227,218,0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(px - LENS_RADIUS * 2, py - LENS_RADIUS * 2, LENS_RADIUS * 4, LENS_RADIUS * 4);
      }

      const r = dotR * (1 + (zoom - 1) * 0.55);
      const lensR2 = LENS_RADIUS * LENS_RADIUS;
      const strength = reduce ? 0 : presence;
      // On wide screens, fade dots out before they reach the headline column.
      const fadeFrom = w > 1100 ? w * 0.32 : -Infinity;
      const fadeTo = w > 1100 ? w * 0.415 : -Infinity;

      for (let i = 0; i < n; i++) {
        const d = dots[i];
        let x = sx(bx[i]);
        let y = sy(by[i]);
        if (!frozen) y += Math.sin(t / 1900 + d.phase) * 0.7; // slow breathing drift

        // Lens: push dots away from the pointer with a slight swirl; ease there and back.
        const vx = x - px;
        const vy = y - py;
        const d2 = vx * vx + vy * vy;
        let tox = 0;
        let toy = 0;
        let tg = 0;
        if (strength > 0.001 && d2 < lensR2 * 4) {
          const f = strength * Math.exp(-d2 / lensR2);
          const dist = Math.sqrt(d2) || 1;
          const ux = vx / dist;
          const uy = vy / dist;
          tox = (ux * LENS_PUSH - uy * LENS_PUSH * 0.25) * f;
          toy = (uy * LENS_PUSH + ux * LENS_PUSH * 0.25) * f;
          tg = f;
        }
        ox[i] += (tox - ox[i]) * kDots;
        oy[i] += (toy - oy[i]) * kDots;
        glow[i] += (tg - glow[i]) * kDots;
        x += ox[i];
        y += oy[i];
        if (x < -12 || y < -12 || x > w + 12 || y > h + 12) continue;
        if (x < fadeTo) {
          const a = (x - fadeFrom) / (fadeTo - fadeFrom);
          if (a <= 0) continue;
          ctx!.globalAlpha = a * a * (3 - 2 * a); // smoothstep
        } else ctx!.globalAlpha = 1;

        const tw = frozen ? 0.5 : (Math.sin(t / 1100 + d.phase) + 1) / 2;
        const gl = glow[i];
        if (d.near) {
          ctx!.fillStyle = `rgba(143,227,218,${0.1 + tw * 0.16 + gl * 0.15})`;
          ctx!.beginPath();
          ctx!.arc(x, y, r * (2.6 + gl * 0.8), 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = "#8fe3da";
        } else if (gl > 0.04) {
          // Blend toward mint as the lens passes over.
          const rr = Math.round(95 + (143 - 95) * gl);
          const gg = Math.round(169 + (227 - 169) * gl);
          const b = Math.round(162 + (218 - 162) * gl);
          ctx!.fillStyle = `rgba(${rr},${gg},${b},${Math.min(1, 0.45 + tw * 0.25 + gl * 0.5)})`;
        } else {
          ctx!.fillStyle = `rgba(95,169,162,${0.38 + tw * 0.3})`;
        }
        ctx!.beginPath();
        ctx!.arc(x, y, (d.near ? r * 1.25 : r) * (1 + gl * 0.9), 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      if (focusIdx >= 0) {
        const c = cityXY[focusIdx];
        const lx = sx(c.x);
        const ly = sy(c.y);
        label!.style.setProperty("--lx", `${lx}px`);
        label!.style.setProperty("--ly", `${ly}px`);
        label!.classList.toggle("flip", lx > w - 240);
      }
    }

    function settled() {
      return (
        Math.abs(zoomTarget - zoom) < 0.001 &&
        Math.abs(presenceTarget - presence) < 0.002 &&
        Math.abs(fxT - fx) < 0.2 &&
        Math.abs(fyT - fy) < 0.2 &&
        Math.abs(leanX) + Math.abs(leanY) < 0.1
      );
    }

    function tick(now: number) {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      const k = (tau: number) => (reduce ? 1 : ease(dt, tau));
      px += (tx - px) * k(TAU.pointer);
      py += (ty - py) * k(TAU.pointer);
      presence += (presenceTarget - presence) * k(TAU.presence);
      zoom += (zoomTarget - zoom) * k(TAU.zoom);
      fx += (fxT - fx) * k(TAU.focus);
      fy += (fyT - fy) * k(TAU.focus);
      const cx = frame.x + frame.w / 2;
      const cy = frame.y + frame.h / 2;
      const leanTX = reduce ? 0 : (px - cx) * LEAN * presenceTarget;
      const leanTY = reduce ? 0 : (py - cy) * LEAN * presenceTarget;
      leanX += (leanTX - leanX) * k(TAU.lean);
      leanY += (leanTY - leanY) * k(TAU.lean);

      draw(now, dt);

      const idle = (reduce || pausedRef.current) && presenceTarget === 0 && settled();
      if (visible && !document.hidden && !idle) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        last = 0;
      }
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const local = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const p = local(e);
      if (presenceTarget === 0) {
        // Enter from where the cursor is, not from the last exit point.
        px = p.x;
        py = p.y;
      }
      tx = p.x;
      ty = p.y;
      presenceTarget = 1;
      updateFocus();
      kick();
    };
    const onLeave = () => {
      presenceTarget = 0;
      updateFocus();
      hero.classList.remove("zoomable");
      kick();
    };
    const onTap = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if ((e.target as HTMLElement).closest("a,button,input")) return;
      const p = local(e);
      if (zoomTarget > 1) {
        onLeave();
        return;
      }
      tx = px = p.x;
      ty = py = p.y;
      presenceTarget = 1;
      updateFocus();
      if (zoomTarget === 1) presenceTarget = 0;
      kick();
    };

    layout();
    px = tx = frame.x + frame.w / 2;
    py = ty = frame.y + frame.h / 2;
    kick();

    const ro = new ResizeObserver(() => {
      layout();
      kick();
    });
    ro.observe(hero);
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) kick();
    });
    io.observe(hero);
    const onVis = () => !document.hidden && kick();
    document.addEventListener("visibilitychange", onVis);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    hero.addEventListener("pointerup", onTap);
    window.addEventListener("tc-hero-resume", kick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      hero.removeEventListener("pointerup", onTap);
      window.removeEventListener("tc-hero-resume", kick);
    };
  }, []);

  function togglePause() {
    const next = !paused;
    pausedRef.current = next;
    setPaused(next);
    if (!next) window.dispatchEvent(new Event("tc-hero-resume"));
  }

  return (
    <>
      <canvas ref={canvasRef} aria-hidden />
      <div ref={labelRef} className="map-label" aria-hidden />
      <div className="map-bar">
        <span>
          <i className="dot" aria-hidden /> Massachusetts
        </span>
        <span>
          <i className="dot near" aria-hidden /> Cities with recruiting study sites
        </span>
        <span className="zoom-hint">
          <ZoomIn aria-hidden /> Point at a city to zoom in
        </span>
        <button type="button" className="pause" onClick={togglePause} aria-pressed={paused}>
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          <span>
            {paused ? "Play" : "Pause"}
            <span className="pause-long"> animation</span>
          </span>
        </button>
      </div>
    </>
  );
}
