// ============================================================
// TennisAI — Lightweight i18n utility
// Shared translation helper. Swap `LOCALE` or back this with
// react-i18next later without changing call sites.
// ============================================================

type Primitive = string | number;
type Vars = Record<string, Primitive>;

export const LOCALE = "en";

const messages: Record<string, Record<string, string>> = {
  en: {
    "nav.trainings.unreviewedBadge": "{count}",
    "nav.trainings.unreviewedAria":
      "{count, plural, one {# session needs review} other {# sessions need review}}",
  },
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