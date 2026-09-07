import { useId } from "react";
import { SURFACE_COLOR } from "@/lib/calendar/colors";
import { cn } from "@/lib/utils";
import type { Surface } from "@/types";

// ============================================================================
// TennisAI — court surface art
//
// Drawn, not photographed. The three JPEGs this replaces came in with the
// original scaffold carrying no licence and no attribution, and the fourth
// surface (indoor) never had a photo at all — so the picker showed three
// photographs and one flat colour block. Generated art makes all four
// consistent, and it is ours: see src/assets/ATTRIBUTION.md.
//
// TWO RULES THIS FILE KEEPS
//
// 1. Every HUE comes from `SURFACE_COLOR` (src/lib/calendar/colors.ts), so a
//    court tile and the same surface's calendar chip are the same colour. The
//    only other paint used is neutral white/black at low opacity — tint and
//    shade, not a second palette. Where a surface needs a *different* hue
//    (worn grass shows the soil underneath; an indoor hall is cooler than
//    daylight) it borrows another SURFACE_COLOR entry rather than inventing
//    one.
// 2. The frame is the same `viewBox="0 0 400 300"` + `xMidYMid slice` the line
//    overlay in SurfaceImage uses, and the playing rectangle is the same
//    trapezoid. That is what makes the painted lines land on the edges of the
//    art instead of floating over it.
// ============================================================================

/** The overlay's outer court, verbatim — the two must not drift apart. */
const COURT = "M 90 70 L 310 70 L 370 270 L 30 270 Z";

/**
 * The ground plane: the court's own sidelines widened until they fill the
 * frame. Both edges still run through the court's vanishing point (200, −297),
 * so anything interpolated between them — a mown stripe, a swept arc —
 * recedes *with* the court rather than against it.
 */
const GROUND = { topLeft: -10, topRight: 410, nearLeft: -222, nearRight: 622 };

/** Neutral tint / shade. Hues come from SURFACE_COLOR; these do not. */
const TINT = "hsl(0 0% 100%)";
const SHADE = "hsl(0 0% 0%)";

/** A stripe of the ground plane, from `t0` to `t1` across its width. */
function groundBand(t0: number, t1: number): string {
  const far = (t: number) => GROUND.topLeft + t * (GROUND.topRight - GROUND.topLeft);
  const near = (t: number) => GROUND.nearLeft + t * (GROUND.nearRight - GROUND.nearLeft);
  return `M ${far(t0).toFixed(1)} 0 L ${far(t1).toFixed(1)} 0 L ${near(t1).toFixed(1)} 300 L ${near(t0).toFixed(1)} 300 Z`;
}

const MOWN_STRIPES = 9;

interface CourtSurfaceArtProps {
  /** Which court to draw. Each one has its own construction, not just a hue. */
  surface: Surface;
  /**
   * Base colour. Defaults to the surface's calendar colour; a caller that
   * already has it (SurfaceImage does) passes the same value through.
   */
  color?: string;
  className?: string;
}

/**
 * The surface texture of a tennis court, as inline SVG — no court markings.
 * SurfaceImage draws those on top, so this must not.
 *
 * Decorative: `aria-hidden`. The tile it sits in carries the accessible name.
 */
export function CourtSurfaceArt({
  surface,
  color = SURFACE_COLOR[surface],
  className,
}: CourtSurfaceArtProps) {
  // Four of these render side by side in the picker, so every gradient and
  // filter id has to be unique per instance. useId() returns ":r0:" — the
  // colons are legal in an id but not in a url(#…) reference.
  const uid = useId().replace(/:/g, "");
  const grain = `court-grain-${uid}`;
  const drift = `court-drift-${uid}`;
  const wear = `court-wear-${uid}`;
  const sky = `court-sky-${uid}`;
  const pool = `court-pool-${uid}`;
  const hall = `court-hall-${uid}`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        {/*
          Texture. One fractal-noise field with five octaves rather than a wall
          of hand-placed speckles: the low frequencies read as blotchy wear at
          96 px in the picker tile, the high ones as grain at full width. A
          single-frequency noise would vanish into flat grey at the small size.
        */}
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={surface === "clay" ? 0.055 : 0.045}
            numOctaves={5}
            seed={surface.length * 7}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>

        {surface === "clay" && (
          <linearGradient id={drift} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor={TINT} stopOpacity="0.11" />
            <stop offset="0.45" stopColor={TINT} stopOpacity="0" />
            <stop offset="1" stopColor={SHADE} stopOpacity="0.17" />
          </linearGradient>
        )}

        {surface === "grass" && (
          // Soft-edged, because worn grass does not have an outline.
          <radialGradient id={wear}>
            <stop offset="0" stopColor={SURFACE_COLOR.clay} stopOpacity="0.42" />
            <stop offset="0.6" stopColor={SURFACE_COLOR.clay} stopOpacity="0.18" />
            <stop offset="1" stopColor={SURFACE_COLOR.clay} stopOpacity="0" />
          </radialGradient>
        )}

        {surface === "hard" && (
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={TINT} stopOpacity="0.12" />
            <stop offset="0.55" stopColor={TINT} stopOpacity="0" />
            <stop offset="1" stopColor={SHADE} stopOpacity="0.12" />
          </linearGradient>
        )}

        {surface === "indoor" && (
          <>
            <radialGradient id={pool}>
              <stop offset="0" stopColor={TINT} stopOpacity="0.16" />
              <stop offset="1" stopColor={TINT} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={hall} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={SHADE} stopOpacity="0.22" />
              <stop offset="0.42" stopColor={SHADE} stopOpacity="0" />
            </linearGradient>
          </>
        )}
      </defs>

      {surface === "clay" && (
        <>
          {/* Clay is clay everywhere: the run-off is the same material as the
              playing area, which is exactly why a clay court has no tone
              change at the sidelines. */}
          <rect width="400" height="300" fill={color} />
          {/* Damp and dark at one end, dried out and pale at the other. */}
          <rect width="400" height="300" fill={`url(#${drift})`} />
          {/* Broom arcs. The drag mat is pulled in long curves, so they flatten
              towards the far baseline with the perspective. */}
          <g fill="none" strokeLinecap="round">
            <g stroke={TINT} strokeOpacity="0.08" strokeWidth="9">
              <path d="M -30 292 C 130 262 270 262 430 292" />
              <path d="M -30 246 C 112 222 288 222 430 246" />
              <path d="M -30 198 C 120 181 280 181 430 198" />
            </g>
            <g stroke={SHADE} strokeOpacity="0.06" strokeWidth="5">
              <path d="M -30 268 C 122 240 278 240 430 268" />
              <path d="M -30 222 C 116 200 284 200 430 222" />
              <path d="M -30 150 C 126 139 274 139 430 150" />
            </g>
          </g>
        </>
      )}

      {surface === "grass" && (
        <>
          <rect width="400" height="300" fill={color} />
          {/* Mown stripes: the mower runs the length of the court, so they are
              the ground plane's own converging bands. Alternating tint and
              shade is the whole effect — the grass is one colour, the light
              off it is not. */}
          {Array.from({ length: MOWN_STRIPES }, (_, i) => (
            <path
              key={i}
              d={groundBand(i / MOWN_STRIPES, (i + 1) / MOWN_STRIPES)}
              fill={i % 2 === 0 ? TINT : SHADE}
              fillOpacity={i % 2 === 0 ? 0.09 : 0.07}
            />
          ))}
          {/* Baseline wear. Grass gives out where players stand and what shows
              through is the soil underneath — so it is tinted with the clay
              hue rather than a brown invented for it. */}
          <ellipse cx="200" cy="266" rx="150" ry="20" fill={`url(#${wear})`} />
          <ellipse cx="200" cy="72" rx="96" ry="11" fill={`url(#${wear})`} />
          {/* Serve-and-volley scuff, mid-court. */}
          <ellipse cx="200" cy="204" rx="34" ry="9" fill={`url(#${wear})`} opacity="0.55" />
        </>
      )}

      {surface === "hard" && (
        <>
          {/* A hard court's giveaway to the eye is not its colour, it is the
              two-tone build: the playing rectangle is one acrylic, the apron
              around it another. Nothing else here needs to say "hard". */}
          <rect width="400" height="300" fill={color} />
          <rect width="400" height="300" fill={SHADE} opacity="0.27" />
          <path d={COURT} fill={color} />
          <path d={COURT} fill={TINT} opacity="0.07" />
          {/* Outdoors the sky lights it from above, so the far half sits
              lighter than the near half. */}
          <rect width="400" height="300" fill={`url(#${sky})`} />
        </>
      )}

      {surface === "indoor" && (
        <>
          {/* Same acrylic build as the hard court — it IS a hard court — but
              under lamps: the two tones sit closer together, nothing is warmed
              by daylight, and the hall behind the far baseline goes dark. */}
          <rect width="400" height="300" fill={color} />
          <rect width="400" height="300" fill={SHADE} opacity="0.15" />
          <path d={COURT} fill={color} />
          <path d={COURT} fill={TINT} opacity="0.035" />
          {/* Cool cast, borrowed from the hard-court blue rather than invented:
              artificial light with no sky bounce to warm it. */}
          <rect width="400" height="300" fill={SURFACE_COLOR.hard} opacity="0.1" />
          {/* Two overhead pools instead of one even wash. */}
          <ellipse cx="132" cy="128" rx="152" ry="88" fill={`url(#${pool})`} />
          <ellipse cx="288" cy="236" rx="168" ry="96" fill={`url(#${pool})`} />
          <rect width="400" height="300" fill={`url(#${hall})`} />
        </>
      )}

      {/* Grain last, over everything, so it sits on the tones rather than
          under them. */}
      <rect
        width="400"
        height="300"
        filter={`url(#${grain})`}
        opacity={surface === "clay" ? 0.17 : surface === "grass" ? 0.13 : surface === "hard" ? 0.1 : 0.07}
        style={{ mixBlendMode: "overlay" }}
      />
    </svg>
  );
}
