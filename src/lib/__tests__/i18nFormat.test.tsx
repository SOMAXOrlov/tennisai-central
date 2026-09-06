// The Intl-backed formatters behind the i18n sweep. Every migrated screen calls
// these instead of `toLocaleDateString("en-US", …)` or `` `${x.toFixed(1)}%` ``,
// so the thing worth proving is that they genuinely follow the active locale —
// a helper that quietly stays English defeats the whole exercise.
import { render, screen, act, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LocaleProvider,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  getDateFnsLocale,
  useT,
  type Locale,
} from "@/lib/i18n";

const NOW = new Date("2026-03-10T12:00:00Z");
const MARCH_3 = new Date("2026-03-03T12:00:00Z");

/** Renders every formatter once and exposes the locale setter to the test. */
function Probe({ onReady }: { onReady: (setLocale: (l: Locale) => void) => void }) {
  const f = useT();
  onReady(f.setLocale);
  return (
    <dl>
      <dd data-testid="number">{f.formatNumber(12500)}</dd>
      <dd data-testid="percent">{f.formatPercent(63.6)}</dd>
      <dd data-testid="currency">{f.formatCurrency(1250, "EUR")}</dd>
      <dd data-testid="date">
        {f.formatDate(MARCH_3, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
      </dd>
      <dd data-testid="relative">{f.formatRelativeTime(new Date("2026-03-07T12:00:00Z"), { now: NOW })}</dd>
      <dd data-testid="dateFns">{f.getDateFnsLocale().code ?? ""}</dd>
    </dl>
  );
}

function renderProbe() {
  let setLocale: (l: Locale) => void = () => {};
  render(
    <LocaleProvider>
      <Probe onReady={(s) => { setLocale = s; }} />
    </LocaleProvider>,
  );
  return {
    read: (id: string) => screen.getByTestId(id).textContent,
    switchTo: (l: Locale) => act(() => setLocale(l)),
  };
}

/**
 * The active locale is module-level state that only `LocaleProvider` writes,
 * so a test that switches to Spanish would leak into the next one. Mounting a
 * throwaway provider with "en" stored runs the same code path the app runs on
 * boot and puts the module back to English.
 */
beforeEach(() => {
  localStorage.setItem("tennisai_locale", "en");
  render(
    <LocaleProvider>
      <span />
    </LocaleProvider>,
  );
  cleanup();
});

describe("i18n formatters", () => {
  it("English is the default and formats the English way", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    const probe = renderProbe();
    expect(probe.read("number")).toBe("12,500");
    expect(probe.read("percent")).toBe("63.6%");
    expect(probe.read("date")).toBe("March 3, 2026");
    expect(probe.read("relative")).toBe("3 days ago");
    expect(probe.read("dateFns")).toBe("en-US");
  });

  it("switching to Spanish re-renders every formatter in Spanish", () => {
    const probe = renderProbe();
    probe.switchTo("es");
    // Spanish groups four-digit numbers without a separator and uses a comma
    // for decimals — the two conventions an English-only formatter gets wrong.
    expect(probe.read("number")).toBe("12.500");
    // Intl puts a non-breaking space before the Spanish percent sign.
    expect(probe.read("percent")?.replace(/\u00A0/g, " ")).toBe("63,6 %");
    expect(probe.read("date")).toContain("marzo");
    expect(probe.read("relative")).toBe("hace 3 días");
    expect(probe.read("dateFns")).toBe("es");
    probe.switchTo("en");
  });

  it("the currency stays the entry's own code in both languages — never converted", () => {
    const probe = renderProbe();
    expect(probe.read("currency")).toContain("€");
    expect(probe.read("currency")).toContain("1,250");
    probe.switchTo("es");
    expect(probe.read("currency")).toContain("€");
    // Same amount, Spanish grouping — the figure itself must not move.
    expect(probe.read("currency")).toContain("1250");
    probe.switchTo("en");
  });
});

describe("formatPercent", () => {
  it("treats its input as a 0–100 percentage, not an Intl fraction", () => {
    // The classic trap: Intl's percent style would render 63.6 as 6,360%.
    expect(formatPercent(63.6)).toBe("63.6%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("honours a requested precision", () => {
    expect(formatPercent(63.64, { maximumFractionDigits: 0 })).toBe("64%");
  });

  it("passes a non-finite value through instead of printing NaN%", () => {
    expect(formatPercent(Number.NaN)).toBe("NaN");
  });
});

describe("formatCurrency", () => {
  it("renders the amount in the currency it was recorded in", () => {
    expect(formatCurrency(1250, "USD")).toBe("$1,250");
  });

  it("falls back to a readable amount rather than throwing on a bad code", () => {
    expect(formatCurrency(80, "not-a-code")).toBe("80 NOT-A-CODE");
  });

  it("defaults a missing code to USD instead of rendering an empty currency", () => {
    expect(formatCurrency(80, "")).toBe("$80");
  });
});

describe("formatRelativeTime", () => {
  it("picks the largest unit that fits, in both directions", () => {
    expect(formatRelativeTime(new Date("2026-03-10T10:00:00Z"), { now: NOW })).toBe("2 hours ago");
    expect(formatRelativeTime(new Date("2026-02-08T12:00:00Z"), { now: NOW })).toBe("last month");
    expect(formatRelativeTime(new Date("2026-03-13T12:00:00Z"), { now: NOW })).toBe("in 3 days");
  });

  it("collapses anything under a minute to 'now'", () => {
    expect(formatRelativeTime(new Date("2026-03-10T11:59:30Z"), { now: NOW })).toBe("now");
  });

  it("passes an unparseable value straight through", () => {
    expect(formatRelativeTime("not a date")).toBe("not a date");
  });
});

describe("plain formatters outside React", () => {
  it("still work for non-hook callers", () => {
    expect(formatNumber(1250)).toBe("1,250");
    expect(formatDate(MARCH_3, { month: "short", day: "numeric", timeZone: "UTC" })).toBe("Mar 3");
    expect(getDateFnsLocale().code).toBe("en-US");
  });
});
