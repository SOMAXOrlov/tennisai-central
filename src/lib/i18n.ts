// ============================================================
// TennisAI — Lightweight i18n utility
// Shared translation helper. Message bundles live in
// `src/locales/<locale>.json`. To add a new language, drop in a
// new JSON file and register it in the `messages` map below.
// ============================================================

import en from "@/locales/en.json";

type Primitive = string | number;
type Vars = Record<string, Primitive>;
type MessageNode = string | { [key: string]: MessageNode };
type MessageBundle = Record<string, MessageNode>;

export const DEFAULT_LOCALE = "en";
export const LOCALE: string = DEFAULT_LOCALE;

const messages: Record<string, MessageBundle> = {
  en: en as MessageBundle,
};

const warnedMissingKeys = new Set<string>();

function warnMissingKey(locale: string, key: string): void {
  if (!import.meta.env.DEV) return;
  const dedupeKey = `${locale}:${key}`;
  if (warnedMissingKeys.has(dedupeKey)) return;
  warnedMissingKeys.add(dedupeKey);
  // eslint-disable-next-line no-console
  console.warn(`[i18n] Missing translation for key "${key}" in locale "${locale}".`);
}

/**
 * Look up a dot-delimited key in a bundle.
 * Supports both nested objects (`{ dashboard: { nav: { trainings: "..." } } }`)
 * and flat keys (`{ "dashboard.nav.trainings": "..." }`) for backward compatibility.
 * Flat keys take precedence so existing bundles keep working unchanged.
 */
function lookup(bundle: MessageBundle | undefined, key: string): string | undefined {
  if (!bundle) return undefined;

  // Flat-key shortcut (back-compat with existing en.json).
  const flat = bundle[key];
  if (typeof flat === "string") return flat;

  // Nested traversal.
  const segments = key.split(".");
  let node: MessageNode | undefined = bundle as MessageNode;
  for (const segment of segments) {
    if (node === undefined || typeof node === "string") return undefined;
    node = (node as { [k: string]: MessageNode })[segment];
  }
  return typeof node === "string" ? node : undefined;
}

/** Resolve a key to a template, falling back to the default locale, then the key itself. */
function resolveTemplate(key: string): string {
  const current = lookup(messages[LOCALE], key);
  if (current !== undefined) return current;

  warnMissingKey(LOCALE, key);

  if (LOCALE !== DEFAULT_LOCALE) {
    const fallback = lookup(messages[DEFAULT_LOCALE], key);
    if (fallback !== undefined) return fallback;
    warnMissingKey(DEFAULT_LOCALE, key);
  }

  return key;
}

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
  const template = resolveTemplate(key);
  const withPlurals = formatPlural(template, vars);
  return interpolate(withPlurals, vars);
}