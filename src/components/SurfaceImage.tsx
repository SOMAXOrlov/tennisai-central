import { useState } from "react";
import { cn } from "@/lib/utils";

interface SurfaceImageProps {
  src: string;
  name: string;
  /** CSS color used for the fallback tint when the image fails to load. */
  color: string;
  /** Responsive `sizes` attribute. Defaults to a 1/3-grid layout. */
  sizes?: string;
  className?: string;
  /** Intrinsic width/height for layout stability. */
  width?: number;
  height?: number;
  /** Set true for above-the-fold images to skip lazy loading. */
  eager?: boolean;
}

/**
 * Responsive court-surface image with lazy-loading and a graceful
 * CSS-only fallback (tinted court-line pattern) when the asset fails.
 */
export function SurfaceImage({
  src,
  name,
  color,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
  width = 768,
  height = 576,
  eager = false,
}: SurfaceImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${name} tennis court surface`}
        className={cn(
          "court-fallback flex h-full w-full items-center justify-center",
          className,
        )}
        style={{ backgroundColor: color }}
      >
        <span className="relative z-10 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground shadow-sm backdrop-blur">
          {name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
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
        fetchPriority={eager ? "high" : "low"}
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
    </div>
  );
}