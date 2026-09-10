// ============================================================
// String tension — kilograms stored, pounds shown alongside.
//
// The API (and the whole gear domain) stores tension in KILOGRAMS only; see
// docs/catalogue.md "Units". Pounds are a display conversion done here, in one
// place, so the two units can never disagree in the database. The factor is
// the one the server documents: lbs = kg × 2.2046.
// ============================================================

export const LBS_PER_KG = 2.2046;

/** The API's accepted range, mirrored so the form can refuse before a round trip. */
export const TENSION_MIN_KG = 10;
export const TENSION_MAX_KG = 35;

/** 23 → 51. Whole pounds: that is how stringing machines and shops quote them. */
export function kgToLbs(kg: number): number {
  return Math.round(kg * LBS_PER_KG);
}

/** 52 → 23.6 (one decimal — half-kilo steps are the finest anyone strings). */
export function lbsToKg(lbs: number): number {
  return Math.round((lbs / LBS_PER_KG) * 10) / 10;
}

/**
 * Parse what a person typed into a tension field. Accepts "23", "23.5" and
 * "23,5" (a Spanish keyboard's decimal comma). Anything else, or a value
 * outside the API's range, is null — the caller shows a validation message
 * rather than sending a number the server will reject.
 */
export function parseTensionKg(input: string): number | null {
  const normalised = input.trim().replace(",", ".");
  if (normalised === "") return null;
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  if (n < TENSION_MIN_KG || n > TENSION_MAX_KG) return null;
  return Math.round(n * 10) / 10;
}

/** A single tension in both units: "23 kg · 51 lb". */
export function formatTensionKg(kg: number, formatNumber: (n: number) => string = String): string {
  return `${formatNumber(kg)} kg · ${formatNumber(kgToLbs(kg))} lb`;
}

/**
 * Mains and crosses in both units. Crosses absent (or equal to mains) ⇒ one
 * figure; otherwise "24 / 22 kg · 53 / 49 lb", mains first as stringers say it.
 */
export function formatSetupTension(
  mainsKg: number,
  crossesKg: number | null | undefined,
  formatNumber: (n: number) => string = String,
): string {
  if (typeof crossesKg !== "number" || crossesKg === mainsKg) return formatTensionKg(mainsKg, formatNumber);
  return `${formatNumber(mainsKg)} / ${formatNumber(crossesKg)} kg · ${formatNumber(kgToLbs(mainsKg))} / ${formatNumber(kgToLbs(crossesKg))} lb`;
}
