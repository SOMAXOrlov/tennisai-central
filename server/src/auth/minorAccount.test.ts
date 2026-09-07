// ============================================================================
// isMinorAccount — the question the photo read endpoint asks before it decides
// who may look.
//
// Signup only ever asks this about a date the applicant has just typed. This
// asks it about a stored row, which may predate the date-of-birth column
// altogether, so it has to answer for accounts whose age is simply not known.
// Those two fail-closed branches are NEW policy and are pinned here, next to
// the ordinary cases, so nobody softens them by accident.
// ============================================================================

import { describe, it, expect, afterEach } from "vitest";
import { DEFAULT_MINOR_AGE_THRESHOLD, isMinorAccount, resetThresholdWarning } from "./guardianConsent";

/** A fixed "today" so a birthday never makes this suite fail on one day a year. */
const TODAY = new Date("2026-09-07T10:00:00.000Z");

function account(overrides: Partial<Parameters<typeof isMinorAccount>[0]> = {}) {
  return {
    dateOfBirth: null,
    guardianConsentRequired: false,
    // The seeded and self-registered adult case: no date of birth on the row,
    // but the account affirmed the minimum age at signup.
    ageConfirmedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.MINOR_AGE_THRESHOLD;
  resetThresholdWarning();
});

describe("isMinorAccount — from a date of birth", () => {
  it("is true below the threshold", () => {
    // 14 on the fixed date.
    expect(isMinorAccount(account({ dateOfBirth: "2012-03-04" }), TODAY)).toBe(true);
  });

  it("is false at the threshold and above", () => {
    // Exactly 16 today: at the threshold is not below it.
    expect(isMinorAccount(account({ dateOfBirth: "2010-09-07" }), TODAY)).toBe(false);
    expect(isMinorAccount(account({ dateOfBirth: "1990-01-01" }), TODAY)).toBe(false);
  });

  it("is true the day before a sixteenth birthday and false on it", () => {
    expect(isMinorAccount(account({ dateOfBirth: "2010-09-08" }), TODAY)).toBe(true);
    expect(isMinorAccount(account({ dateOfBirth: "2010-09-07" }), TODAY)).toBe(false);
  });

  it("reads the threshold from the environment rather than a constant", () => {
    const fourteen = account({ dateOfBirth: "2012-03-04" });
    expect(DEFAULT_MINOR_AGE_THRESHOLD).toBe(16);
    expect(isMinorAccount(fourteen, TODAY)).toBe(true);

    // Spain's age of digital consent. The same account is now an adult here.
    process.env.MINOR_AGE_THRESHOLD = "14";
    expect(isMinorAccount(fourteen, TODAY)).toBe(false);
  });

  it("ignores ageConfirmedAt when a date of birth is present", () => {
    // A 14-year-old who ticked "I am old enough" is still 14. A real date beats
    // a checkbox, exactly as signup decides it.
    expect(
      isMinorAccount(account({ dateOfBirth: "2012-03-04", ageConfirmedAt: new Date() }), TODAY),
    ).toBe(true);
  });
});

describe("isMinorAccount — the explicit flag", () => {
  it("is true whenever guardianConsentRequired is set, whatever else the row says", () => {
    expect(
      isMinorAccount(account({ guardianConsentRequired: true, dateOfBirth: "1980-01-01" }), TODAY),
    ).toBe(true);
  });
});

describe("isMinorAccount — fails closed when the age is unknown", () => {
  it("treats a date of birth that will not parse as a minor", () => {
    for (const nonsense of ["not-a-date", "2026-02-30", "3000-01-01", "12/03/2011", "2011-3-4"]) {
      expect(isMinorAccount(account({ dateOfBirth: nonsense }), TODAY)).toBe(true);
    }
  });

  it("treats an account that has never said anything about its age as a minor", () => {
    expect(isMinorAccount(account({ dateOfBirth: null, ageConfirmedAt: null }), TODAY)).toBe(true);
    expect(isMinorAccount(account({ dateOfBirth: "", ageConfirmedAt: null }), TODAY)).toBe(true);
  });

  it("accepts an affirmed minimum age when there is no date of birth", () => {
    // The pre-date-of-birth signup path, and every seeded account.
    expect(isMinorAccount(account({ dateOfBirth: null }), TODAY)).toBe(false);
  });
});
