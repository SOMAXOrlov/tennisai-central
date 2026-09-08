// The age the code enforces and the age the legal pages promise must be the
// same number.
//
// They were not. The default was 16, the owner moved the deployment to Spain's
// 14, and the privacy policy and terms still told the reader 16 — one of them
// in a sentence that read "This deployment is set to 16, while Spain's is 14".
// A policy that overstates the protection a child gets is the worst kind of
// error in this document, and nothing would have caught it.
//
// This test lives on the server because that is where the constant lives. It
// reaches across into the client's locale files on purpose: they are the only
// other place the number is written down, and a test that cannot see both
// cannot prove they agree.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_MINOR_AGE_THRESHOLD } from "../guardianConsent";

const LOCALES = ["en", "es"] as const;

/** Only the parts this test reads. Declared rather than `any`: a typo in one of
 *  these paths should be a compile error, not an undefined at runtime. */
interface LegalCopy {
  privacy: {
    minors: { body: string };
    open: { item7: string };
  };
  terms: {
    minors: { body: string };
  };
}

function loadLegal(locale: string): LegalCopy {
  // server/src/auth/__tests__ -> repo root -> src/locales
  const path = resolve(__dirname, "..", "..", "..", "..", "src", "locales", `${locale}.json`);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { legal: LegalCopy };
  return parsed.legal;
}

/** Standalone integers in the GDPR range that a reader could take as the age. */
function candidateAges(text: string): number[] {
  return [...text.matchAll(/\b(1[3-6])\b/g)].map((m) => Number(m[1]));
}

/**
 * The clause that states THIS deployment's age, isolated.
 *
 * Both sentences name the enforced age inside an em-dashed aside — "… this
 * deployment is configured with — 14 unless the operator changes it — nothing
 * extra happens" — and then go on to explain that GDPR Art. 8 leaves the age
 * to each member state, "13 to 16". Reading the whole sentence therefore finds
 * three ages, only one of which is a claim about this product. The first draft
 * of this test asserted against the whole sentence and failed on the range,
 * which is a test being wrong rather than the copy.
 */
function enforcedAgeClause(text: string): string {
  const m = text.match(/[—–]([^—–]+)[—–]/);
  if (!m) throw new Error(`no em-dashed clause naming the age in: ${text.slice(0, 120)}…`);
  return m[1];
}

describe("the age of digital consent, in the code and on the page", () => {
  it.each(LOCALES)("%s: the privacy policy states the age the code enforces", (locale) => {
    const legal = loadLegal(locale);
    const ages = new Set(candidateAges(enforcedAgeClause(legal.privacy.minors.body)));

    // Exactly one age is nameable in this sentence, and it is the one enforced.
    // Not "contains 14" — that would still pass if the sentence also said 16.
    expect([...ages]).toEqual([DEFAULT_MINOR_AGE_THRESHOLD]);
  });

  it.each(LOCALES)("%s: the terms state the same age", (locale) => {
    const legal = loadLegal(locale);
    const ages = new Set(candidateAges(enforcedAgeClause(legal.terms.minors.body)));
    expect([...ages]).toEqual([DEFAULT_MINOR_AGE_THRESHOLD]);
  });

  it.each(LOCALES)("%s: the still-open list names the enforced age", (locale) => {
    const legal = loadLegal(locale);
    const item = legal.privacy.open.item7;

    // This entry legitimately mentions other member states' ages, so it is not
    // held to a single number — only to naming the one in force here.
    expect(candidateAges(item)).toContain(DEFAULT_MINOR_AGE_THRESHOLD);

    // And it must no longer describe the old mismatch as unresolved.
    expect(item).not.toMatch(/set to 16|configurada en 16/i);
  });

  it("is a real number in the GDPR range, not a placeholder", () => {
    expect(Number.isInteger(DEFAULT_MINOR_AGE_THRESHOLD)).toBe(true);
    expect(DEFAULT_MINOR_AGE_THRESHOLD).toBeGreaterThanOrEqual(13);
    expect(DEFAULT_MINOR_AGE_THRESHOLD).toBeLessThanOrEqual(16);
  });
});
