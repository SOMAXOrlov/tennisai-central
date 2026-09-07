import { useState } from "react";
import { CourtSurfaceArt } from "@/components/courts/CourtSurfaceArt";
import { cn } from "@/lib/utils";
import type { Surface } from "@/types";

interface SurfaceImageProps {
  /**
   * Photo of the court. Empty string means "there is no photo" and the drawn
   * court in `CourtSurfaceArt` is used instead — which is what every surface
   * does today. THE `<img>` PATH BELOW IS LIVE CODE, NOT DEAD CODE: the moment
   * a real club photograph is passed here it is rendered again, lazy-loading,
   * skeleton, line overlay and all, with no further change to this file.
   */
  src: string;
  name: string;
  /**
   * Which court to draw when there is no photo. Defaults to the acrylic
   * hard-court build; the tint always comes from `color`, so a caller that has
   * only a colour still gets a plausible court rather than a colour block.
   */
  surface?: Surface;
  /** CSS color used for the surface tint (drawn court, and image skeleton). */
  color: string;
  /** Responsive `sizes` attribute. Defaults to a 1/3-grid layout. */
  sizes?: string;
  className?: string;
  /** Intrinsic width/height for layout stability. */
  width?: number;
  height?: number;
  /** Set true for above-the-fold images to skip lazy loading. */
  eager?: boolean;
  /**
   * CSS color for the painted court-line overlay. Defaults to white. Pass
   * a per-surface tint (slightly warm white for clay, cool white for grass,
   * etc.) so the lines feel painted-on rather than drawn over the photo.
   */
  lineColor?: string;
  /**
   * Opacity for the line overlay (0–1). Lower values on high-contrast
   * surfaces (clay) prevent the markings from looking overdrawn.
   */
  lineOpacity?: number;
}

/**
 * Painted court markings, in perspective, over whatever surface is beneath.
 * Extracted so the drawn-court and the photo paths share exactly one copy of
 * the overlay — the two must never drift apart, or the drawn art stops lining
 * up with the lines.
 */
function CourtLines({ lineColor, lineOpacity }: { lineColor: string; lineOpacity: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: lineOpacity }}
    >
      <g
        fill="none"
        stroke={lineColor}
        strokeWidth={2.6}
        strokeLinecap="square"
        strokeLinejoin="miter"
        style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))" }}
      >
        {/* Outer court (perspective trapezoid: far baseline narrower) */}
        <path d="M 90 70 L 310 70 L 370 270 L 30 270 Z" />
        {/* Net line (centered horizontally across the court) */}
        <line x1="60" y1="170" x2="340" y2="170" strokeWidth={3} />
        {/* Service line on the near (camera-side) half only */}
        <line x1="50" y1="225" x2="350" y2="225" />
        {/* Center service line — between net and near service line */}
        <line x1="200" y1="170" x2="200" y2="225" />
      </g>
    </svg>
  );
}

/**
 * Responsive court-surface image with lazy-loading, and a drawn court
 * (`CourtSurfaceArt`) whenever there is no usable photo — no `src`, or an
 * `src` that failed to load.
 *
 * ## Aspect ratio
 *
 * The wrapper applies an intrinsic `aspect-ratio` derived from the
 * `width` / `height` props (defaults to 768×576 → 4/3) so space is
 * reserved before the image loads — preventing CLS at every breakpoint.
 *
 * To override the ratio, choose ONE of these approaches:
 *
 * 1. **Parent-driven ratio** (recommended for grids):
 *    Wrap `<SurfaceImage />` in a parent with a Tailwind aspect class
 *    and let it stretch to fill. The inner wrapper's intrinsic ratio
 *    is harmlessly overridden because it sizes to `h-full w-full`.
 *
 *    ```tsx
 *    <div className="aspect-[4/3] overflow-hidden rounded-xl">
 *      <SurfaceImage src={clay} name="Clay" color="hsl(var(--court-clay))" />
 *    </div>
 *    ```
 *
 * 2. **Custom intrinsic dimensions**:
 *    Pass `width` / `height` to set both the rendered `<img>` size hints
 *    and the wrapper's `aspect-ratio` (e.g. 16:9 banner).
 *
 *    ```tsx
 *    <SurfaceImage
 *      src={grass}
 *      name="Grass"
 *      color="hsl(var(--court-grass))"
 *      width={1920}
 *      height={1080}
 *      eager
 *      sizes="100vw"
 *    />
 *    ```
 *
 * 3. **Above-the-fold hero**:
 *    Set `eager` to skip lazy-loading and bump fetch priority.
 *
 *    ```tsx
 *    <SurfaceImage src={hard} name="Hard" color="hsl(var(--court-hard))" eager />
 *    ```
 */
export function SurfaceImage({
  src,
  name,
  surface = "hard",
  color,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
  width = 768,
  height = 576,
  eager = false,
  lineColor = "hsl(0 0% 100%)",
  lineOpacity = 0.92,
}: SurfaceImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Intrinsic aspect ratio derived from width/height so the wrapper
  // reserves space even when a parent doesn't constrain height. This
  // prevents CLS at every breakpoint while still allowing a parent
  // (e.g. `aspect-[4/3]`) to override via `h-full`.
  const aspectRatio = `${width} / ${height}`;

  // No photo at all, or one that failed to load: draw the court instead of
  // showing a flat colour block. Same frame, same line overlay, so the tile
  // reads as a court either way. No skeleton and no shimmer here — there is
  // nothing loading to wait for.
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`${name} tennis court surface`}
        className={cn("relative h-full w-full overflow-hidden", className)}
        style={{ aspectRatio }}
      >
        <CourtSurfaceArt surface={surface} color={color} />
        <CourtLines lineColor={lineColor} lineOpacity={lineOpacity} />
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ aspectRatio }}
    >
      {/* Themed skeleton: tinted court color + painted lines + shimmer.
          Sits behind the image and fades out once loaded. */}
      <div
        aria-hidden="true"
        className={cn(
          "court-fallback court-skeleton absolute inset-0 transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100",
        )}
        style={{ backgroundColor: color }}
      />
      <img
        src={src}
        alt={`${name} tennis court surface`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        // Lowercase, and spread so TS accepts it: React 18 does not know the
        // camelCase spelling, so it forwards it as an unknown attribute — a
        // console warning on every render, and the browser ignores the hint.
        {...{ fetchpriority: eager ? "high" : "low" }}
        width={width}
        height={height}
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
      {/* Painted court lines overlay — only the essential markings, drawn
          in perspective so the surface photo underneath reads as a real
          court. A subtle drop-shadow keeps lines legible on every surface. */}
      <CourtLines lineColor={lineColor} lineOpacity={lineOpacity} />
    </div>
  );
}