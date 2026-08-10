import { useEffect, useRef } from "react";

/**
 * The landing hero: a floodlit court rebuilt in perspective, with one point
 * played out on it.
 *
 * Two things are worth knowing before changing anything here.
 *
 * First, the court is not a drawing — it is measured. Every dimension below is
 * the real ITF court, and the ball is projected through the same camera as the
 * lines, so a ball that looks in *is* in. The rally was rewritten once because
 * a shot landed 485mm past the singles sideline; anyone editing RALLY should
 * keep it legal, and the comment there says what legal means.
 *
 * Second, this runs on requestAnimationFrame, which the global
 * `prefers-reduced-motion` rule in index.css cannot switch off — that rule only
 * reaches CSS. The media query is therefore checked here by hand, and when it
 * is set the court is painted once, still, with the marks already down.
 */

/* ── The court, in metres (ITF) ─────────────────────────────────────────── */
const DOUBLES_W = 10.97;
const SINGLES_W = 8.23;
const COURT_L = 23.77;
const SERVICE = 6.4; // service line, measured from the net
const NET_Z = COURT_L / 2;
const NET_MID = 0.914; // net height at the centre …
const NET_POST = 1.07; // … and at the posts; the cord sags between them

/* ── The camera ─────────────────────────────────────────────────────────
   Television covers tennis from high behind the baseline on a long lens. An
   earlier draft sat 11.5m back at 6.2m — a 78° field of view — and the court
   came out looking stretched, like a diagram rather than a court. */
const CAM_H = 8.95; // metres above the court
const CAM_D = 20; // metres behind the near baseline
const NEAR_BASELINE = 0.94; // where the near baseline sits, as a fraction of height
const HORIZON = 0.05;

/* ── Palette ────────────────────────────────────────────────────────────
   Hardcoded rather than themed: the hero band is deliberately floodlit night
   in both light and dark mode, so these must not follow the theme. The trace
   colour is the one exception — it reads --tennis-ball, which the app already
   defines. */
/* Deliberately dim. A first pass used a daylight blue (#1d5787) and the hero
   paragraph became unreadable where it crossed the court — the copy is the
   point of the page, the court is behind it. These are a floodlit court seen
   at night, which is both truer to the reference and quiet enough to set type
   over. */
const SURFACE = "#17425f"; // the painted court
const APRON = "#102a3b"; // run-off around it
const DARK_TOP = "#080f1a";
const DARK_BOTTOM = "#0c1a29";
const LINES = "rgba(226,236,247,0.72)";
const TRACE_FALLBACK = "hsl(72 95% 60%)";

type Vec3 = [number, number, number];
type Cam = { f: number; H: number; D: number; ox: number; hz: number };

type Shot = {
  /** Where the ball was struck: x across, y up, z down the court. */
  hit: Vec3;
  /** Where it lands, on the ground: [x, z]. */
  land: [number, number];
  /** Arc height. Bigger is loopier. */
  arc: number;
};

/**
 * One point, played legally.
 *
 * Every `land` is inside the singles court — |x| <= 4.115 and 0 < z < 23.77 —
 * and on the far side of the net from the `hit` that produced it. The serve
 * additionally lands inside a service box (z between 5.485 and 11.885). Each
 * `hit` is where the previous ball was played after its bounce, so the rally
 * is one continuous point rather than a series of teleports.
 *
 * Margins inside the sideline run from 515mm to 1715mm, and net clearance from
 * 130mm (the flat serve) to 680mm.
 */
const RALLY: Shot[] = [
  { hit: [1.6, 2.55, 24.6], land: [-2.4, 7.4], arc: 0.5 }, // serve, into the deuce box
  { hit: [-3.6, 1.05, -0.6], land: [2.9, 19.8], arc: 1.25 }, // return, deep
  { hit: [3.3, 1.1, 24.9], land: [3.5, 7.9], arc: 1.3 }, // crosscourt
  { hit: [3.9, 1.0, -0.4], land: [-3.2, 20.6], arc: 1.2 }, // changes direction
  { hit: [-3.4, 1.05, 24.6], land: [-3.6, 5.6], arc: 1.15 }, // short angle, winner
];

const FLIGHT_S = 0.95;
const BOUNCE_S = 0.55;
const BUILD_S = 2.1; // the court draws itself before the point starts
const HOLD_S = 1.5; // pause on the finished point before replaying

export function RallyCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // jsdom has no 2D context, and neither do a few locked-down browsers.
    // Bail rather than throw: the band still renders, just without the court.
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf: number | null = null;
    let dpr = 1;
    let t = 0;
    let marks: { x: number; z: number; age: number }[] = [];
    let idx = 0;
    let phase: "flight" | "bounce" | "over" = "flight";
    let u = 0;
    let idle = 0;

    const trace = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--tennis-ball")
        .trim();
      return raw ? `hsl(${raw})` : TRACE_FALLBACK;
    };

    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /* A level camera already gives correct perspective — no rotation matrix
       needed. Pitch is only where the horizon sits. Focal length is derived
       from the height so the whole court fits whatever box the hero ends up,
       instead of being cropped on short viewports. */
    const cam = (w: number, h: number, drift: number): Cam => {
      const hz = h * HORIZON;
      return {
        f: ((h * NEAR_BASELINE - hz) * CAM_D) / CAM_H,
        H: CAM_H,
        D: CAM_D + Math.sin(drift) * 0.6,
        ox: w / 2 + Math.sin(drift * 0.7) * w * 0.012,
        hz,
      };
    };

    const proj = (p: Cam, x: number, y: number, z: number): Vec3 => {
      const d = Math.max(z + p.D, 0.4);
      return [p.ox + (p.f * x) / d, p.hz + (p.f * (p.H - y)) / d, d];
    };

    const seg = (p: Cam, a: number[], b: number[]) => {
      const s = proj(p, a[0], 0, a[1]);
      const e = proj(p, b[0], 0, b[1]);
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.stroke();
    };

    // Ground-plane polygons stay straight under a pinhole camera, so a quad is
    // just its four projected corners.
    const quad = (p: Cam, corners: number[][], fill: string) => {
      ctx.beginPath();
      corners.forEach((c, i) => {
        const q = proj(p, c[0], 0, c[1]);
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    const netHeightAt = (x: number) => {
      const xm = DOUBLES_W / 2 + 0.914;
      const k = Math.min(Math.abs(x) / xm, 1);
      return NET_MID + (NET_POST - NET_MID) * k * k;
    };

    const drawNet = (p: Cam, alpha: number) => {
      if (alpha <= 0) return;
      const xm = DOUBLES_W / 2 + 0.914;
      const N = 28;
      ctx.globalAlpha = alpha;

      ctx.beginPath(); // mesh
      for (let i = 0; i <= N; i++) {
        const x = -xm + 2 * xm * (i / N);
        const q = proj(p, x, netHeightAt(x), NET_Z);
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      }
      for (let i = N; i >= 0; i--) {
        const q = proj(p, -xm + 2 * xm * (i / N), 0, NET_Z);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(8,14,24,0.45)";
      ctx.fill();

      // Strands. Without them the net fills as a flat dark quad and reads as a
      // rectangle sitting on the court rather than as netting.
      ctx.strokeStyle = "rgba(190,206,224,0.16)";
      ctx.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        const x = -xm + 2 * xm * (i / N);
        const top = proj(p, x, netHeightAt(x), NET_Z);
        const foot = proj(p, x, 0, NET_Z);
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(foot[0], foot[1]);
        ctx.stroke();
      }
      [0.28, 0.56, 0.84].forEach((frac) => {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const x = -xm + 2 * xm * (i / N);
          const q = proj(p, x, netHeightAt(x) * frac, NET_Z);
          if (i) ctx.lineTo(q[0], q[1]);
          else ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      });

      ctx.beginPath(); // white tape along the cord
      for (let i = 0; i <= N; i++) {
        const x = -xm + 2 * xm * (i / N);
        const q = proj(p, x, netHeightAt(x), NET_Z);
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      }
      ctx.strokeStyle = "rgba(240,245,252,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      [-xm, xm].forEach((x) => {
        const b = proj(p, x, 0, NET_Z);
        const tp = proj(p, x, NET_POST, NET_Z);
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(tp[0], tp[1]);
        ctx.strokeStyle = "rgba(210,220,232,0.75)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };

    const drawCourt = (p: Cam, tt: number) => {
      const hw = DOUBLES_W / 2;
      const hs = SINGLES_W / 2;
      const surf = Math.max(0, Math.min(tt / 0.6, 1));
      const drawn = Math.max(0, Math.min((tt - 0.4) / 1.5, 1));

      // Apron first, then the painted court. Without a surface the white lines
      // float on a gradient, which is what made an earlier draft look flat.
      ctx.globalAlpha = surf;
      quad(
        p,
        [
          [-hw - 5.5, -6.5],
          [hw + 5.5, -6.5],
          [hw + 5.5, COURT_L + 6.5],
          [-hw - 5.5, COURT_L + 6.5],
        ],
        APRON,
      );
      quad(
        p,
        [
          [-hw, 0],
          [hw, 0],
          [hw, COURT_L],
          [-hw, COURT_L],
        ],
        SURFACE,
      );
      ctx.globalAlpha = 1;

      const segs = [
        [[-hw, 0], [hw, 0]], // baselines
        [[-hw, COURT_L], [hw, COURT_L]],
        [[-hw, 0], [-hw, COURT_L]], // doubles sidelines
        [[hw, 0], [hw, COURT_L]],
        [[-hs, 0], [-hs, COURT_L]], // singles sidelines — the in/out limit
        [[hs, 0], [hs, COURT_L]],
        [[-hs, NET_Z - SERVICE], [hs, NET_Z - SERVICE]],
        [[-hs, NET_Z + SERVICE], [hs, NET_Z + SERVICE]],
        [[0, NET_Z - SERVICE], [0, NET_Z + SERVICE]], // centre service line
        [[0, 0], [0, 0.3]], // centre marks
        [[0, COURT_L - 0.3], [0, COURT_L]],
      ];

      ctx.strokeStyle = LINES;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "butt";
      const n = Math.floor(drawn * segs.length);
      for (let i = 0; i < segs.length; i++) {
        if (i > n) break;
        ctx.globalAlpha = i === n ? drawn * segs.length - n : 1;
        seg(p, segs[i][0], segs[i][1]);
      }
      ctx.globalAlpha = 1;

      drawNet(p, Math.max(0, Math.min((tt - 1.55) / 0.45, 1)));
    };

    /* Flight is a parabola in u. With horizontal speed constant, u is
       proportional to time, so a parabola in u is what gravity actually does.
       It starts at the contact height and reaches exactly 0 at the landing
       point, so the ball touches down where the mark goes. */
    const flightAt = (s: Shot, k: number): Vec3 => [
      s.hit[0] + (s.land[0] - s.hit[0]) * k,
      s.hit[1] * (1 - k) + 4 * s.arc * k * (1 - k),
      s.hit[2] + (s.land[1] - s.hit[2]) * k,
    ];

    // After the bounce the ball runs on to wherever it is next struck.
    const bounceAt = (land: [number, number], next: Vec3, k: number): Vec3 => [
      land[0] + (next[0] - land[0]) * k,
      4 * 1.15 * k * (1 - k) + next[1] * k,
      land[1] + (next[2] - land[1]) * k,
    ];

    const polyline = (p: Cam, at: (k: number) => Vec3, upto: number, n: number) => {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const b = at((k / n) * upto);
        const q = proj(p, b[0], b[1], b[2]);
        if (k) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
    };

    const drawBall = (p: Cam, b: Vec3) => {
      const q = proj(p, b[0], b[1], b[2]);
      const g = proj(p, b[0], 0, b[2]);
      const r = Math.max(1.8, 62 / q[2]);

      // The shadow is what tells you how high the ball is.
      ctx.globalAlpha = Math.max(0.08, 0.4 - b[1] * 0.06);
      ctx.fillStyle = "#04101c";
      ctx.beginPath();
      ctx.ellipse(g[0], g[1], r * 1.5, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#f6ffd0";
      ctx.beginPath();
      ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawMarks = (p: Cam) => {
      marks.forEach((m) => {
        const g = proj(p, m.x, 0, m.z);
        const rx = Math.max(3, 150 / g[2]);
        const ry = rx * 0.32;
        const age = Math.min(m.age, 1);
        ctx.globalAlpha = 0.28 + 0.4 * (1 - m.age * 0.3);
        ctx.fillStyle = "rgba(211,250,56,0.35)";
        ctx.beginPath();
        ctx.ellipse(g[0], g[1], rx * age, ry * age, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = trace();
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(g[0], g[1], rx * age, ry * age, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    };

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const p = cam(w, h, t * 0.25);

      // Beyond the run-off it is a night match: darkness, not a glowing floor.
      const g = ctx.createLinearGradient(0, p.hz, 0, h);
      g.addColorStop(0, DARK_TOP);
      g.addColorStop(1, DARK_BOTTOM);
      ctx.fillStyle = g;
      ctx.fillRect(0, p.hz, w, h - p.hz);

      drawCourt(p, t);
      drawMarks(p);
      marks.forEach((m) => (m.age = Math.min(m.age + 0.06, 1)));

      if (t < BUILD_S) return;

      const s = RALLY[idx];
      const next = RALLY[idx + 1];
      ctx.strokeStyle = trace();
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(211,250,56,0.5)";
      ctx.shadowBlur = 8;

      if (phase === "flight") {
        polyline(p, (k) => flightAt(s, k), u, 40);
        ctx.shadowBlur = 0;
        drawBall(p, flightAt(s, u));
      } else if (phase === "bounce" && next) {
        polyline(p, (k) => flightAt(s, k), 1, 40);
        ctx.globalAlpha = 0.5;
        polyline(p, (k) => bounceAt(s.land, next.hit, k), u, 24);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        drawBall(p, bounceAt(s.land, next.hit, u));
      } else {
        polyline(p, (k) => flightAt(s, k), 1, 40);
      }
      ctx.shadowBlur = 0;
    };

    const step = (dt: number) => {
      if (t < BUILD_S) return;
      const s = RALLY[idx];

      if (phase === "flight") {
        u += dt / FLIGHT_S;
        if (u >= 1) {
          u = 0;
          marks.push({ x: s.land[0], z: s.land[1], age: 0 });
          phase = idx + 1 < RALLY.length ? "bounce" : "over";
        }
      } else if (phase === "bounce") {
        u += dt / BOUNCE_S;
        if (u >= 1) {
          u = 0;
          idx++;
          phase = "flight";
        }
      } else {
        idle += dt;
        if (idle > HOLD_S) {
          idx = 0;
          u = 0;
          idle = 0;
          phase = "flight";
          marks = [];
        }
      }
    };

    const loop = () => {
      t += 1 / 60;
      step(1 / 60);
      render();
      raf = requestAnimationFrame(loop);
    };

    /* Reduced motion: the finished court, once. Held at the END of the point —
       every mark down and the winning shot's trace drawn — rather than at the
       start, which would freeze a ball in mid-air over the server's head. */
    const still = () => {
      fit();
      t = 99;
      idx = RALLY.length - 1;
      phase = "over";
      u = 1;
      marks = RALLY.map((s) => ({ x: s.land[0], z: s.land[1], age: 1 }));
      render();
    };

    const start = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf === null) return;
      cancelAnimationFrame(raf);
      raf = null;
    };

    if (reduced) {
      still();
      const onResizeStill = () => still();
      window.addEventListener("resize", onResizeStill);
      return () => window.removeEventListener("resize", onResizeStill);
    }

    fit();
    render(); // paint synchronously so the band is never a transparent hole
    start();

    const onResize = () => {
      fit();
      render();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    // Don't render a court nobody is looking at.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => (e.isIntersecting ? start() : stop()));
        },
        { threshold: 0.05 },
      );
      io.observe(canvas);
    }

    return () => {
      stop();
      io?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}

export default RallyCanvas;
