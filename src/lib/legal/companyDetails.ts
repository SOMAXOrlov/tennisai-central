// ============================================================================
// The company details the legal pages need — and do not have yet.
//
// WHY EVERY VALUE IS A `{{TOKEN}}`
// The privacy policy and the terms used to carry invented specifics: a
// `privacy@tennisai.example` address that nobody reads, a `hello@` twin of it,
// and a "last updated" line built from `new Date()` so the document appeared to
// have been revised this morning, every morning. All three read as facts. None
// of them were.
//
// So the values below are deliberately unresolved. They render through
// `<LegalToken>` as a visibly marked placeholder, which means a reader (and the
// person who has to sign this off) can see at a glance exactly which fields are
// still missing, and a screenshot of the page is self-documenting.
//
// HOW TO FILL THEM IN
// Replace the literals here — nothing else imports the raw strings — once
// counsel has decided each one. `LEGAL_EFFECTIVE_DATE` must become a FIXED date
// string, written by hand on the day the document is adopted. It must never go
// back to `new Date()`: an effective date that moves is not an effective date.
//
// `DEMO_CONTACT_EMAIL` is the landing page's "book a demo" address. Until it is
// real the mailto: on that button does not resolve to a mailbox, and the page
// says so next to the button rather than pretending otherwise.
// ============================================================================

/** Legal name and legal form of the entity behind Tennis AI. */
export const COMPANY_NAME = "{{COMPANY_NAME}}";

/** Registered address of that entity. */
export const COMPANY_ADDRESS = "{{COMPANY_ADDRESS}}";

/** General contact address for legal and account questions. */
export const COMPANY_CONTACT_EMAIL = "{{COMPANY_CONTACT_EMAIL}}";

/** Where data-protection requests (access, rectification, erasure) go. */
export const COMPANY_DPO_EMAIL = "{{COMPANY_DPO_EMAIL}}";

/** Governing law and the courts with jurisdiction. */
export const COMPANY_JURISDICTION = "{{COMPANY_JURISDICTION}}";

/**
 * The date the legal documents take effect.
 *
 * A constant on purpose — see the note at the top of this file. When it is
 * filled in, write the date out in full (e.g. "1 March 2026") rather than
 * formatting a `Date`, so the string a reader sees is the string in review.
 */
export const LEGAL_EFFECTIVE_DATE = "{{LEGAL_EFFECTIVE_DATE}}";

/** Mailbox behind the landing page's "book a demo" button. */
export const DEMO_CONTACT_EMAIL = "{{COMPANY_DEMO_EMAIL}}";

/**
 * True while a value is still an unresolved `{{TOKEN}}`.
 *
 * Lets a surface degrade honestly — the landing page uses it to explain that
 * its demo button has no mailbox behind it yet — and gives the tests one place
 * to assert against, instead of matching braces by hand.
 */
export function isUnresolved(value: string): boolean {
  return /^\{\{[A-Z0-9_]+\}\}$/.test(value.trim());
}
