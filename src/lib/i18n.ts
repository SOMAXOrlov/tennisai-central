// ============================================================
// TennisAI — Lightweight i18n utility
// Shared translation helper. Message bundles live in
// `src/locales/<locale>.json`. To add a new language, drop in a
// new JSON file and register it in the `messages` map below.
// ============================================================

import en from "@/locales/en.json";

type Primitive = string | number;
type Vars = Record<string, Primitive>;
type MessageBundle = Record<string, string>;

export const DEFAULT_LOCALE = "en";
export const LOCALE: string = DEFAULT_LOCALE;

const messages: Record<string, MessageBundle> = {
  en: en as MessageBundle,
};

/** Format an ICU-lite plural: `{var, plural, one {…} other {…}}`. `#` is replaced with the value. */
function formatPlural(template: string, vars: Vars): string {
  return template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
    (_match, name: string, one: string, other: string) => {
      const value = Number(vars[name] ?? 0);
      const branch = value === 1 ? one : other;
      return branch.replace(/#/g, formatNumber(value));
    },
  );
}

function interpolate(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_m, name: string) =>
    name in vars ? formatNumber(vars[name]) : `{${name}}`,
  );
}

/** Locale-aware number formatting (handles thresholds via Intl). */
export function formatNumber(value: Primitive): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(LOCALE).format(n);
}

/** Format a count for compact UI badges (e.g. 99+ when over threshold). */
export function formatBadgeCount(count: number, max = 99): string {
  if (count > max) return `${formatNumber(max)}+`;
  return formatNumber(count);
}

/** Translate a key with optional interpolation + ICU-lite plurals. */
export function t(key: string, vars: Vars = {}): string {
  const template = messages[LOCALE]?.[key] ?? messages.en[key] ?? key;
  const withPlurals = formatPlural(template, vars);
  return interpolate(withPlurals, vars);
}