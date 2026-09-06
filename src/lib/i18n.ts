// ============================================================
// TennisAI — Lightweight i18n utility
// Shared translation helper. Message bundles live in
// `src/locales/<locale>.json`. To add a new language, drop in a
// new JSON file, register it in the `messages` map below, and add
// it to `SUPPORTED_LOCALES`.
// ============================================================

import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { enUS, es as esDateFns } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

type Primitive = string | number;
type Vars = Record<string, Primitive>;
type MessageNode = string | { [key: string]: MessageNode };
type MessageBundle = Record<string, MessageNode>;

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = "tennisai_locale";

const messages: Record<Locale, MessageBundle> = {
  en: en as MessageBundle,
  es: es as MessageBundle,
};

function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Module-level "current" locale. Bare (non-hook) callers of `t`/`formatNumber`
// — e.g. src/components/search/searchIndex.ts, which builds its result list
// outside of React render — read whatever this is set to. `LocaleProvider`
// keeps it in sync with the React-visible `locale` it hands out via `useT`,
// so a hook consumer re-renders on change while a bare caller picks up the
// new value the next time it happens to run.
let currentLocale: Locale = DEFAULT_LOCALE;

/** Read the active locale (for non-hook callers). */
export function getLocale(): Locale {
  return currentLocale;
}

function readStoredLocale(): Locale | null {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    return stored && isSupportedLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * `navigator.languages` (falling back to `navigator.language`), first tag
 * whose base language (`"es-MX"` → `"es"`) is one we support. Falls back to
 * `DEFAULT_LOCALE` ("en") — explicit product decision: default follows the
 * browser, not the other way to Spanish, and English is the safe fallback
 * when the browser doesn't tell us anything we support.
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const lang of languages) {
    if (!lang) continue;
    const base = lang.split("-")[0].toLowerCase();
    if (isSupportedLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** A user's explicit past choice (localStorage) wins; otherwise detect from the browser. */
function detectInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale();
}

function applyLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

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
  const current = lookup(messages[currentLocale], key);
  if (current !== undefined) return current;

  warnMissingKey(currentLocale, key);

  if (currentLocale !== DEFAULT_LOCALE) {
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
  return new Intl.NumberFormat(currentLocale).format(n);
}

/**
 * A number at a fixed number of decimals — "1.20" in `en`, "1,20" in `es`.
 * `toFixed` always writes a dot, which is wrong in most of the world.
 */
export function formatDecimal(value: number, digits: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(currentLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
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

/**
 * A LIST of copy items stored as a JSON array, e.g. the equipment upgrade tips.
 * Returns the strings in order for the active locale, falling back to English,
 * and an empty list when the key is missing — a caller mapping over it then
 * renders nothing rather than a key path.
 */
export function tList(key: string): string[] {
  const read = (bundle: MessageBundle | undefined): string[] | undefined => {
    if (!bundle) return undefined;
    const segments = key.split(".");
    let node: MessageNode | undefined = bundle as MessageNode;
    for (const segment of segments) {
      if (node === undefined || typeof node === "string") return undefined;
      node = (node as { [k: string]: MessageNode })[segment];
    }
    if (!node || typeof node === "string") return undefined;
    const values = Object.values(node);
    return values.every((v): v is string => typeof v === "string") ? values : undefined;
  };
  return read(messages[currentLocale]) ?? read(messages[DEFAULT_LOCALE]) ?? [];
}

// ------------------------------------------------------------------
// Sentences with React nodes inside them
// ------------------------------------------------------------------

/**
 * A marker for "a React node goes here", to be passed as an interpolation
 * variable. It uses NUL, which no copy will ever contain, and carries the
 * node's index so a translation may put the slots in a different order than
 * English does.
 *
 *     {interleave(t("auth.signUp.terms", { terms: slot(0), privacy: slot(1) }), [
 *       <Link key="terms" to="/terms">{t("auth.signUp.termsLink")}</Link>,
 *       <Link key="privacy" to="/privacy">{t("auth.signUp.privacyLink")}</Link>,
 *     ])}
 *
 * This exists so a sentence with a link or a bold phrase in it stays ONE
 * translatable string. Splitting it into "before"/"after" fragments would hard-
 * code English word order into the markup.
 */
export function slot(index: number): string {
  return `\u0000${index}\u0000`;
}

/** Put the React nodes back into a translated sentence produced with `slot()`. */
export function interleave(text: string, nodes: ReactNode[]): ReactNode[] {
  // `split` with a capturing group alternates literal text and captured index.
  return text.split(/\u0000(\d+)\u0000/).map((part, i) => (i % 2 === 1 ? nodes[Number(part)] : part));
}

/** Locale-aware date formatting — thin wrapper so migrated screens don't reach for `Intl` ad hoc. */
export function formatDate(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(currentLocale, options).format(date);
}

/**
 * The `date-fns` locale object for the active locale, for the call sites that
 * legitimately keep a `date-fns` pattern string (`"d MMM"`, `"EEEE"`, …).
 * `format(date, pattern, { locale: getDateFnsLocale() })` then renders month
 * and weekday names in the active language instead of always English.
 * Everything else should use `formatDate` and let `Intl` pick the pattern.
 */
export function getDateFnsLocale(): DateFnsLocale {
  return currentLocale === "es" ? esDateFns : enUS;
}

/** Milliseconds per unit, largest first — `formatRelativeTime` picks the first that fits. */
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/**
 * "3 days ago" / "hace 3 días" — locale-aware relative time via
 * `Intl.RelativeTimeFormat`. The unit is picked automatically (the largest one
 * the gap fills); anything under a minute renders as "now"/"ahora".
 */
export function formatRelativeTime(
  value: Date | string | number,
  options?: { now?: Date | number; numeric?: Intl.RelativeTimeFormatNumeric },
): string {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return String(value);
  const nowOption = options?.now;
  const nowMs = nowOption instanceof Date ? nowOption.getTime() : nowOption ?? Date.now();
  const diff = time - nowMs;
  const rtf = new Intl.RelativeTimeFormat(currentLocale, { numeric: options?.numeric ?? "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, "second");
}

/**
 * "63.6%" in `en`, "63,6 %" in `es`. The app stores percentages as 0–100
 * numbers and `Intl`'s percent style expects a fraction, so the division lives
 * here — one place, so no call site has to remember it.
 */
export function formatPercent(value: number, options?: { maximumFractionDigits?: number }): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(currentLocale, {
    style: "percent",
    maximumFractionDigits: options?.maximumFractionDigits ?? 1,
  }).format(n / 100);
}

/**
 * "$1,250" / "1250 US$" — the amount in the active locale's number
 * conventions, in the currency the entry was recorded in. Never converted: a
 * euro expense stays euros for a Spanish reader and for an English one.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options?: { maximumFractionDigits?: number },
): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(currentLocale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    }).format(n);
  } catch {
    // An unknown or malformed currency code must not blank out the amount.
    return `${formatNumber(n)} ${code}`;
  }
}

// ------------------------------------------------------------------
// React binding: LocaleProvider + useT()
// ------------------------------------------------------------------

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// Non-throwing default: components rendered without a <LocaleProvider> (most
// of the existing test suite) still get a working "en" translator instead of
// a hook that throws.
const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = detectInitialLocale();
    applyLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next: Locale) => {
    if (next === currentLocale) return;
    applyLocale(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the switch still works for this session.
    }
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale }), [locale, setLocale]);

  return createElement(LocaleContext.Provider, { value }, children);
}

/** The active locale + setter, for UI that needs to render a switcher. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/**
 * Locale-aware translator for components. Re-renders whenever the locale
 * changes (it subscribes to LocaleContext), unlike importing the bare `t`
 * export directly — use this in any component, not the bare `t`.
 */
export function useT() {
  const { locale, setLocale } = useLocale();
  // `t` and the `format*` helpers read the shared module-level `currentLocale`,
  // which `LocaleProvider` keeps in sync with `locale` — referencing it here
  // ties this hook's identity to context updates so consuming components
  // re-render with the new strings. Components must take the formatters from
  // here rather than importing them directly, or a language switch leaves
  // their dates and numbers on the previous locale until something else
  // re-renders them.
  void locale;
  return {
    t,
    formatNumber,
    formatDecimal,
    formatBadgeCount,
    formatDate,
    formatRelativeTime,
    formatPercent,
    formatCurrency,
    getDateFnsLocale,
    locale,
    setLocale,
  };
}
