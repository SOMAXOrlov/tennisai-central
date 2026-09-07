import { Check } from "lucide-react";
import { SurfaceImage } from "@/components/SurfaceImage";
import { SURFACE_COLOR } from "@/lib/calendar/colors";
import type { Surface } from "@/types";
import { cn } from "@/lib/utils";

/**
 * All four surfaces are drawn (`CourtSurfaceArt`), not photographed — the
 * three JPEGs that used to be here had no licence and no attribution, and the
 * fourth surface never had a photo at all.
 *
 * `src` stays on the shape deliberately: a real club photograph for a surface
 * only has to be imported and set here, and `SurfaceImage` renders it instead.
 * Nothing else has to change.
 */
const SURFACES: { value: Surface; label: string; src?: string }[] = [
  { value: "hard", label: "Hard" },
  { value: "clay", label: "Clay" },
  { value: "grass", label: "Grass" },
  { value: "indoor", label: "Indoor" },
];

/**
 * Court-type picker: selectable tiles showing each surface as a drawn court.
 * Replaces a plain surface dropdown so the coach/player sees the court they
 * are choosing.
 */
export function SurfacePicker({
  value,
  onChange,
}: {
  value: Surface;
  onChange: (surface: Surface) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SURFACES.map((s) => {
        const active = value === s.value;
        return (
          <button
            type="button"
            key={s.value}
            onClick={() => onChange(s.value)}
            aria-pressed={active}
            // The tile's own name. Without it the button is named by its
            // contents — image alt plus caption, "Clay tennis court surface
            // Clay" (and "Indoor" twice from the painted fallback).
            aria-label={s.label}
            className={cn(
              "group relative overflow-hidden rounded-lg border-2 transition-all",
              active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
            )}
          >
            <div className="aspect-[4/3]">
              <SurfaceImage
                src={s.src ?? ""}
                surface={s.value}
                name={s.label}
                color={SURFACE_COLOR[s.value]}
              />
            </div>
            <span
              className={cn(
                "absolute bottom-1 left-1 rounded-sm bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur",
                active ? "text-primary" : "text-foreground",
              )}
            >
              {s.label}
            </span>
            {active && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
