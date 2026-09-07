// Is this link safe to put in an href?
//
// The tournament catalog's `website` column is filled from three places: a UTR
// event page, a licensed feed nobody has validated, and a form a coach types
// into. Rendered straight into an `href`, a `javascript:` or `data:` value in
// any of those is stored XSS — the browser runs it on click, with the app's
// origin and the signed-in user's session.
//
// The write path pins the scheme too (see the tournament create route), and
// that is the better place to stop it. This is the second line: a row that
// predates the check, or one a future feed inserts by another path, must not be
// able to turn a link into script just because it reached the client.
//
// Pure and dependency-free, so the render site can call it inline.

/** Schemes a link in this app may use. Anything else is not a link. */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * The URL when it is an ordinary web address, otherwise null.
 *
 * Null means "show the text, do not make it clickable" — the honest rendering
 * of a link this app cannot vouch for. Relative URLs are refused as well:
 * everything this is used for is an external organiser's page, and a value
 * that is not absolute is a sign the data is wrong rather than something to
 * resolve against our own origin.
 */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : null;
  } catch {
    // Not an absolute URL at all.
    return null;
  }
}
