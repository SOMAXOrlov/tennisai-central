// ============================================================================
// Category-specific facts about a piece of equipment — the few a coach or
// stringer actually asks for. Mirrors the per-category validation in
// server/src/equipment/routes.ts; the server is the gate, this is the form.
// ============================================================================
import type { EquipmentCategory, EquipmentSpecs, ShoeSurface } from "@/types";

export const SURFACES: ShoeSurface[] = ["clay", "hard", "grass", "indoor", "all"];

export type SpecKey = keyof EquipmentSpecs;

export interface SpecField {
  key: SpecKey;
  kind: "text" | "number" | "surface";
  /** For number fields: the step the input offers and the bounds the server enforces. */
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}

export const SPEC_FIELDS: Record<EquipmentCategory, SpecField[]> = {
  racket: [
    { key: "gripSize", kind: "text", placeholder: "L3" },
    { key: "weightG", kind: "number", step: 1, min: 200, max: 400, placeholder: "305" },
    { key: "stringPattern", kind: "text", placeholder: "16x19" },
  ],
  string: [
    { key: "gaugeMm", kind: "number", step: 0.01, min: 1, max: 1.6, placeholder: "1.25" },
    { key: "setLengthM", kind: "number", step: 0.5, min: 1, max: 300, placeholder: "12" },
  ],
  shoes: [
    { key: "size", kind: "text", placeholder: "EU 42.5" },
    { key: "surface", kind: "surface" },
  ],
  balls: [{ key: "quantity", kind: "number", step: 1, min: 1, max: 500, placeholder: "4" }],
  accessories: [],
};

/** What the form holds: every field as text, empty when unset. */
export type SpecsForm = Partial<Record<SpecKey, string>>;

export function specsToForm(specs: EquipmentSpecs | undefined): SpecsForm {
  const form: SpecsForm = {};
  if (!specs) return form;
  for (const [k, v] of Object.entries(specs)) {
    if (v !== undefined && v !== null) form[k as SpecKey] = String(v);
  }
  return form;
}

/**
 * The form, typed for the API. Empty fields are left out; a number that does
 * not parse is left out too (the server would 400 it, the form never sends
 * it). Returns null when nothing is set so the row carries no empty object.
 */
export function formToSpecs(category: EquipmentCategory, form: SpecsForm): EquipmentSpecs | null {
  const out: Record<string, string | number> = {};
  for (const field of SPEC_FIELDS[category]) {
    const raw = (form[field.key] ?? "").trim();
    if (!raw) continue;
    if (field.kind === "number") {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n)) continue;
      out[field.key] = n;
    } else {
      out[field.key] = raw;
    }
  }
  return Object.keys(out).length === 0 ? null : (out as EquipmentSpecs);
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Short chips for a row: "Grip L3", "305 g", "16x19"; "1.25 mm", "12 m";
 * "Size EU 42.5", "Clay". The templates live under `equipment.specs.chip.*`.
 */
export function specChips(
  category: EquipmentCategory,
  specs: EquipmentSpecs | undefined,
  t: Translate,
  formatNumber: (n: number) => string,
): string[] {
  if (!specs) return [];
  const chips: string[] = [];
  for (const field of SPEC_FIELDS[category]) {
    const v = specs[field.key];
    if (v === undefined || v === null || v === "") continue;
    const value =
      field.kind === "surface"
        ? t(`equipment.surface.${String(v)}`)
        : typeof v === "number"
          ? formatNumber(v)
          : String(v);
    chips.push(t(`equipment.specs.chip.${field.key}`, { value }));
  }
  return chips;
}
