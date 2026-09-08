// ============================================================================
// isMinorAccount — the question the photo read endpoint asks before it decides
// who may look.
//
// Signup only ever asks this about a date the applicant has just typed. This
// asks it about a stored row, which may predate the date-of-birth column
// altogether, so it has to answer for accounts whose age is simply not known.
// Those two fail-closed branches are NEW policy and are pinned here, next to
// the ordinary cases, so nobody softens them by accident.
//
// EVERY AGE BELOW IS RELATIVE TO THE THRESHOLD, NEVER A NUMBER
// The threshold is configuration — GDPR Art. 8 leaves the age of digital
// consent to each member state — so a fixture written as "a 14-year-old" stops
// meaning "a minor" the moment the deployment moves. Fixtures are therefore
// built from `minorAgeThreshold()`, read live exactly as the code under test
// reads it, and the dates are computed from the fixed TODAY below so the
// arithmetic is on the page instead of buried in a literal.
// ============================================================================

import { describe, it, expect, afterEach } from "vitest";
import { ageFromIsoDate, todayUtc } from "./age";
import { isMinorAccount, minorAgeThreshold, resetThresholdWarning } from "./guardianConsent";

/** A fixed "today" so a birthday never makes this suite fail on one day a year. */
const TODAY = new Date("2026-09-07T10:00:00.000Z");

/**
 * The date of birth of someone whose `years`th birthday falls `dayOffset` days
 * from TODAY. Offset 0 means the birthday is today (so they are exactly
 * `years` old); offset +1 puts it tomorrow, leaving them a day short.
 */
function dobWithBirthday(years: number, dayOffset = 0): string {
  return new Date(
    Date.UTC(TODAY.getUTCFullYear() - years, TODAY.getUTCMonth(), TODAY.getUTCDate() + dayOffset),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * Check a fixture against the real age maths before using it, so a month or
 * leap-year edge in the construction above cannot silently mis-age a test.
 */
function expectAgeOn(dateOfBirth: string, years: number): string {
  expect(ageFromIsoDate(dateOfBirth, todayUtc(TODAY)), `fixture ${dateOfBirth}`).toBe(years);
  return dateOfBirth;
}

/** One year under whatever threshold is in force: the archetypal minor. */
function dobUnderThreshold(): string {
  const years = minorAgeThreshold() - 1;
  return expectAgeOn(dobWithBirthday(years), years);
}

/** Exactly the threshold age today — at it, which is not below it. */
function dobAtThreshold(): string {
  const years = minorAgeThreshold();
  return expectAgeOn(dobWithBirthday(years), years);
}

/** The threshold birthday falls tomorrow: still a day short of it. */
function dobThresholdBirthdayTomorrow(): string {
  const years = minorAgeThreshold();
  return expectAgeOn(dobWithBirthday(years, 1), years - 1);
}

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

// Restored, not deleted: a run that pins MINOR_AGE_THRESHOLD in the
// environment must mean the same thing for the last test as for the first.
const ORIGINAL_THRESHOLD_ENV = process.env.MINOR_AGE_THRESHOLD;

afterEach(() => {
  if (ORIGINAL_THRESHOLD_ENV === undefined) delete process.env.MINOR_AGE_THRESHOLD;
  else process.env.MINOR_AGE_THRESHOLD = ORIGINAL_THRESHOLD_ENV;
  resetThresholdWarning();
});

describe("isMinorAccount — from a date of birth", () => {
  it("is true below the threshold", () => {
    expect(isMinorAccount(account({ dateOfBirth: dobUnderThreshold() }), TODAY)).toBe(true);
  });

  it("is false at the threshold and above", () => {
    expect(isMinorAccount(account({ dateOfBirth: dobAtThreshold() }), TODAY)).toBe(false);

    // And far above it: 20 years clear of the highest threshold the code will
    // accept, so this one is an adult under any jurisdiction.
    const wellOver = minorAgeThreshold() + 20;
    expect(
      isMinorAccount(account({ dateOfBirth: expectAgeOn(dobWithBirthday(wellOver), wellOver) }), TODAY),
    ).toBe(false);
  });

  it("is true the day before the threshold birthday and false on it", () => {
    expect(isMinorAccount(account({ dateOfBirth: dobThresholdBirthdayTomorrow() }), TODAY)).toBe(true);
    expect(isMinorAccount(account({ dateOfBirth: dobAtThreshold() }), TODAY)).toBe(false);
  });

  it("reads the threshold from the environment rather than a constant", () => {
    const threshold = minorAgeThreshold();
    const justUnder = account({ dateOfBirth: dobUnderThreshold() });
    expect(isMinorAccount(justUnder, TODAY)).toBe(true);

    // Move the threshold down onto their own age — one member state's answer
    // in place of another's. The SAME row is now an adult, which is something
    // a baked-in constant could not do.
    process.env.MINOR_AGE_THRESHOLD = String(threshold - 1);
    expect(isMinorAccount(justUnder, TODAY)).toBe(false);
  });

  it("ignores ageConfirmedAt when a date of birth is present", () => {
    // Someone a year under the threshold who ticked "I am old enough" is still
    // a year under it. A real date beats a checkbox, exactly as signup decides.
    expect(
      isMinorAccount(
        account({ dateOfBirth: dobUnderThreshold(), ageConfirmedAt: new Date() }),
        TODAY,
      ),
    ).toBe(true);
  });
});

describe("isMinorAccount — the explicit flag", () => {
  it("is true whenever guardianConsentRequired is set, whatever else the row says", () => {
    // A date of birth 20 years clear of the highest threshold the code accepts
    // — an adult under any jurisdiction — and the flag still wins.
    const wellOver = minorAgeThreshold() + 20;
    expect(
      isMinorAccount(
        account({
          guardianConsentRequired: true,
          dateOfBirth: expectAgeOn(dobWithBirthday(wellOver), wellOver),
        }),
        TODAY,
      ),
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
