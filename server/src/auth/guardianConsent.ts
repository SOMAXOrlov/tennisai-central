// ============================================================================
// Guardian consent — the policy, the token, and the wording.
//
// WHY THIS EXISTS
// The product ships ITF JUNIOR calendars, so a 14-year-old on that circuit is
// the archetypal user. Signup used to hard-require "I am 16 or older" and
// refuse anyone who ticked nothing, which locked out the richest part of the
// addressable market at the front door. The rule is now: derive the age from a
// date of birth; at or above the threshold nothing changes; below it the
// account is created but INERT until a parent or guardian approves it by email.
//
// WHY THE THRESHOLD IS CONFIGURABLE
// GDPR Art. 8 leaves the age of digital consent to each member state and it
// ranges 13-16 (Spain 14, Germany 16, Ireland 16, Denmark 13). Any single baked
// -in number is wrong somewhere by design, so it is read from the environment.
//
// WHY THE DEFAULT IS 14 AND NOT 16
// The default was 16 — the top of that range, and so the cautious choice for a
// deployment that has not said where it operates. The owner has decided this
// product operates under SPANISH law, where the age is 14 (LOPDGDD Art. 7), and
// 14 is now the default.
//
// Understand what that lowers: a 14- or 15-year-old can now use the product
// WITHOUT a guardian ever being involved. That is what Spanish law permits, and
// it is a deliberate decision rather than an oversight.
//
// It is also why the number is not only here. The privacy policy and the terms
// both state this age to the reader, and a policy that says 16 while the code
// enforces 14 is a lie to a parent. `legalPages.test.tsx` asserts the copy
// against this constant, so the two cannot drift apart again — they had already
// drifted once, which is how this comment came to be written. If you change
// this number, that test fails until the copy in BOTH languages is changed too.
// A deployment outside Spain has to revisit the copy, not just the env var.
//
// WHY IT IS READ HERE AND NOT IN src/env.ts
// `src/env.ts` is owned by another workstream in this change. Reading it here,
// per call, keeps the whole feature inside one directory and makes the
// threshold trivially drivable from a test.
// ============================================================================

import { createHash, randomBytes } from "node:crypto";
import { ageFromIsoDate, todayUtc } from "./age";

/**
 * Used when MINOR_AGE_THRESHOLD is unset or unusable.
 *
 * 14 — Spain's age of digital consent. See the note at the top of this file
 * before changing it: the legal pages state this number to the reader and a
 * test holds them to it.
 */
export const DEFAULT_MINOR_AGE_THRESHOLD = 14;

/** Sanity bounds. Outside these the value is a mistake, not a jurisdiction. */
const MIN_ALLOWED_THRESHOLD = 0;
const MAX_ALLOWED_THRESHOLD = 21;

let warnedAboutThreshold = false;

/**
 * The age of digital consent this deployment enforces.
 *
 * Read from `process.env` on every call rather than frozen at import: the value
 * is consulted a handful of times per signup, and reading it live is what lets
 * a spec prove the threshold really is configurable instead of asserting
 * against a constant it also imported.
 *
 * A malformed value falls back to the default and warns ONCE. It deliberately
 * does not exit the process: an operator fat-fingering an env var should not be
 * able to take the whole API down.
 *
 * That reasoning used to end "and the fallback is the strictest common value in
 * the GDPR range anyway", which was true when the default was 16 and is the
 * opposite of true now that it is 14 — the most permissive end of the range,
 * not the strictest. So the fallback is no longer the cautious choice: a
 * mistyped `MINOR_AGE_THRESHOLD` on a deployment that meant to enforce 16
 * quietly enforces Spain's 14 instead. The warning is the only signal, which is
 * why it is a warning and not a debug line.
 */
export function minorAgeThreshold(): number {
  const raw = process.env.MINOR_AGE_THRESHOLD;
  if (raw === undefined || raw.trim() === "") return DEFAULT_MINOR_AGE_THRESHOLD;

  const parsed = Number(raw.trim());
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_ALLOWED_THRESHOLD ||
    parsed > MAX_ALLOWED_THRESHOLD
  ) {
    if (!warnedAboutThreshold) {
      warnedAboutThreshold = true;
      console.warn(
        `⚠️  MINOR_AGE_THRESHOLD="${raw}" is not a whole number between ` +
          `${MIN_ALLOWED_THRESHOLD} and ${MAX_ALLOWED_THRESHOLD}. ` +
          `Falling back to ${DEFAULT_MINOR_AGE_THRESHOLD}.`,
      );
    }
    return DEFAULT_MINOR_AGE_THRESHOLD;
  }
  return parsed;
}

/** Test seam: forget that a bad value was already reported. */
export function resetThresholdWarning(): void {
  warnedAboutThreshold = false;
}

/** The columns the minor question is answered from. Nothing else is consulted. */
export interface MinorCheckFields {
  /** Calendar date of birth, `yyyy-MM-dd`, or null on accounts that never gave one. */
  dateOfBirth: string | null;
  /** Set at signup when the declared date of birth was below the threshold. */
  guardianConsentRequired: boolean;
  /** Set at signup when the account affirmed it meets the minimum age. */
  ageConfirmedAt: Date | null;
}

/**
 * Is this account a minor, for the purposes of deciding who may see something
 * of theirs?
 *
 * The age maths is `ageFromIsoDate` + `todayUtc` + `minorAgeThreshold()` — the
 * same three calls signup makes (auth/routes.ts), deliberately not re-derived,
 * so the threshold stays configurable in one place and a leap-day birthday is
 * handled identically in both.
 *
 * WHERE THIS GOES FURTHER THAN SIGNUP, AND WHY
 * Signup only ever asks the question about a date the applicant just typed.
 * This asks it about a row that may predate the date-of-birth column, so it has
 * to answer for accounts where the age is simply not known. It FAILS CLOSED in
 * both such cases:
 *
 *   - a date of birth that will not parse (malformed, impossible, in the
 *     future) counts as a minor, because `null` from `ageFromIsoDate` has never
 *     meant "old enough";
 *   - no date of birth AND no `ageConfirmedAt` counts as a minor, because the
 *     account has never said anything about its age in either form.
 *
 * The cost of failing closed is that an adult in that state has their photo
 * shown to a narrower audience than the read ladder would otherwise allow —
 * their coach and themselves, not every connection. The cost of failing open is
 * a child's photograph shown to someone who should not have it. That is not a
 * close call.
 *
 * An account with `guardianConsentRequired` set is a minor whatever its other
 * columns say: that flag is the explicit verdict signup already recorded.
 */
export function isMinorAccount(user: MinorCheckFields, now: Date = new Date()): boolean {
  if (user.guardianConsentRequired) return true;

  if (user.dateOfBirth !== null && user.dateOfBirth !== "") {
    const age = ageFromIsoDate(user.dateOfBirth, todayUtc(now));
    if (age === null) return true;
    return age < minorAgeThreshold();
  }

  return user.ageConfirmedAt === null;
}

/**
 * How long a consent link stays usable.
 *
 * Far longer than the 1-hour password-reset window on purpose. A reset link is
 * clicked by someone sitting at the screen who just asked for it; a consent
 * link is sent to a parent who was not at the keyboard, may be in another
 * country, and may not open personal email for a week. An hour would turn the
 * common case into a dead account.
 */
export const GUARDIAN_CONSENT_TTL_DAYS = 30;

// KNOWN GAP, deliberately left open rather than half-built: there is no
// self-service way to re-issue a consent link. If the 30 days lapse, the
// account is stuck — signing up again is refused (the email is registered) and
// nothing else mints a new token. The fix is a "resend to guardian" endpoint,
// which needs its own rate limiting and its own thinking about who is allowed
// to trigger a fresh email to a third party. Until then an operator has to
// intervene, and the consent page says so instead of pretending otherwise.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True when the link is past its window, or was never actually sent. */
export function consentLinkExpired(sentAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!sentAt) return true;
  return now.getTime() - sentAt.getTime() > GUARDIAN_CONSENT_TTL_DAYS * MS_PER_DAY;
}

/**
 * SHA-256 of a consent token, hex encoded.
 *
 * The database stores this digest, never the token itself. The token is a
 * bearer credential — whoever holds it can approve a child's account — so a
 * read of the users table must not hand anyone that power. Lookup still works:
 * hash what the caller presents and look up the digest, which is `@unique`.
 * (The digest is high-entropy, so there is nothing here for a rainbow table.)
 */
export function hashGuardianConsentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Mint a fresh consent token. The caller emails `token` and stores `digest`.
 *
 * `token` must never be written to a response body, a log line, or the UI. If
 * it leaks, the gate is decoration.
 */
export function mintGuardianConsentToken(): { token: string; digest: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: hashGuardianConsentToken(token) };
}

// ── Wording and status codes ────────────────────────────────────────────────

/**
 * 423 Locked, NOT 403.
 *
 * 403 is already this API's answer for "correct password, unverified email",
 * and the login screen keys its "send the link again" offer off it. A distinct
 * status is what lets the client tell a child waiting on a parent apart from a
 * typo'd password — the whole point of not answering "invalid credentials".
 */
export const GUARDIAN_CONSENT_PENDING_STATUS = 423;

/** Machine-readable discriminator, for clients that read the body. */
export const GUARDIAN_CONSENT_PENDING_CODE = "guardian_consent_pending";

export const GUARDIAN_CONSENT_PENDING_MESSAGE =
  "This account is waiting for your parent or guardian to approve it. " +
  "We've emailed them a link — you can sign in as soon as they confirm.";

/** One uniform failure for every bad-token case (unknown, expired, already used). */
export const GUARDIAN_CONSENT_INVALID_MESSAGE =
  "This approval link is invalid, has expired, or has already been used.";
