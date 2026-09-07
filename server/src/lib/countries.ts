// Countries — an ISO 3166-1 alpha-2 code on one side, the country NAME the
// tournament catalog stores on the other.
//
// WHY THIS EXISTS
// `PlayerProfile.homeCountry` holds a code ("US"). `Tournament.country` holds a
// name ("United States"), because that is what the feeds publish and what the
// country filter has always offered. Scoping the tournaments page to a squad's
// own country therefore needs a translation, and it has to be one that FAILS
// VISIBLY: a code that cannot be matched to anything in the catalog must make
// the page say so, not quietly filter to nothing.
//
// WHY NO TABLE OF COUNTRIES
// `Intl.DisplayNames` already knows all of them, in Node and in every browser,
// with no dependency and no 250-row table to drift out of date. The index is
// built once at module load from the 676 possible two-letter codes and cached.
// Only the handful of names where the feeds and Unicode genuinely disagree are
// listed by hand, below.

/**
 * Codes `Intl` will name but which are not a country a player lives in today.
 *
 * Two kinds, and both have to go. Groupings and exceptional reservations,
 * because a home country is a place. And WITHDRAWN codes, because Unicode still
 * names them and names them the SAME as their successor — `Intl.of("UK")` is
 * "United Kingdom", exactly like `GB` — so leaving them in gave two codes for
 * one country and let a save round-trip to the wrong one. The list below is
 * every duplicate the 676-code sweep produced, not a guess; `allCountries` has
 * a test that no two entries share a name, which is what keeps it honest.
 */
const NOT_A_COUNTRY = new Set([
  // Groupings and exceptional reservations.
  "AC", // Ascension Island
  "CP", // Clipperton Island
  "DG", // Diego Garcia
  "EA", // Ceuta & Melilla
  "EU", // European Union
  "EZ", // Eurozone
  "IC", // Canary Islands
  "QO", // Outlying Oceania
  "TA", // Tristan da Cunha
  "UN", // United Nations
  "XA",
  "XB",
  "ZZ", // Unknown region
  // Withdrawn codes Unicode still names, each a duplicate of a live one.
  "AN", // Netherlands Antilles → CW
  "BU", // Burma → MM
  "CS", // Serbia and Montenegro → RS
  "DD", // East Germany → DE
  "DY", // Dahomey → BJ
  "FX", // Metropolitan France → FR
  "HV", // Upper Volta → BF
  "NH", // New Hebrides → VU
  "RH", // Rhodesia → ZW
  "SU", // Soviet Union → RU
  "TP", // East Timor → TL
  "UK", // → GB, which is the ISO code for the United Kingdom
  "VD", // North Vietnam → VN
  "YD", // South Yemen → YE
  "YU", // Yugoslavia → RS
  "ZR", // Zaire → CD
]);

/**
 * Names the feeds use that Unicode words differently, code → extra accepted
 * spellings.
 *
 * Measured, not guessed: of the 54 distinct country names in the live catalog on
 * 7 Sep 2026, exactly three did not match a Unicode name — "Hong Kong" (16
 * events), "The Bahamas" and "Saint Vincent and the Grenadines". The rest of
 * this list is the same class of disagreement for countries that had no events
 * that day but routinely do, so a coach in Prague or Istanbul is not told their
 * country is unknown the first time an event appears there.
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  HK: ["Hong Kong", "Hong Kong SAR", "Hong Kong, China"],
  MO: ["Macau", "Macao", "Macau SAR"],
  BS: ["The Bahamas"],
  VC: ["Saint Vincent and the Grenadines", "St Vincent and the Grenadines"],
  KN: ["Saint Kitts and Nevis", "St Kitts and Nevis"],
  LC: ["Saint Lucia", "St Lucia"],
  CZ: ["Czech Republic"],
  TR: ["Turkey"],
  KR: ["Korea, Republic of", "Republic of Korea", "Korea"],
  KP: ["Korea, Democratic People's Republic of", "North Korea"],
  RU: ["Russian Federation"],
  VN: ["Viet Nam"],
  GB: ["UK", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"],
  US: ["USA", "United States of America"],
  TW: ["Chinese Taipei", "Taiwan, Province of China"],
  CI: ["Ivory Coast", "Cote d'Ivoire"],
  CV: ["Cape Verde"],
  TL: ["East Timor"],
  SZ: ["Swaziland"],
  MD: ["Moldova, Republic of"],
  LA: ["Laos"],
  SY: ["Syria"],
  BO: ["Bolivia"],
  IR: ["Iran"],
  TZ: ["Tanzania"],
  VE: ["Venezuela"],
  MK: ["Macedonia", "FYR Macedonia"],
  PS: ["Palestine"],
  CD: ["Democratic Republic of the Congo", "DR Congo", "Congo, The Democratic Republic of the"],
  CG: ["Republic of the Congo", "Congo"],
  MM: ["Myanmar", "Burma"],
  BN: ["Brunei"],
  AE: ["UAE"],
};

export interface Country {
  /** ISO 3166-1 alpha-2, upper case. */
  code: string;
  /** The Unicode English name — what a matching catalog row is expected to say. */
  name: string;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Built once: every alpha-2 code Unicode can name, and that name in English. */
const CODE_TO_NAME: ReadonlyMap<string, string> = (() => {
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const out = new Map<string, string>();
  for (const a of LETTERS) {
    for (const b of LETTERS) {
      const code = `${a}${b}`;
      if (NOT_A_COUNTRY.has(code)) continue;
      let name: string | undefined;
      try {
        name = display.of(code);
      } catch {
        continue;
      }
      // An unassigned code comes back as itself or as "Unknown Region".
      if (!name || name === code || name.startsWith("Unknown")) continue;
      out.set(code, name);
    }
  }
  return out;
})();

/** Name (lower case, Unicode name and every alias) → code. */
const NAME_TO_CODE: ReadonlyMap<string, string> = (() => {
  const out = new Map<string, string>();
  for (const [code, name] of CODE_TO_NAME) out.set(name.toLowerCase(), code);
  for (const [code, names] of Object.entries(ALIASES)) {
    if (!CODE_TO_NAME.has(code)) continue;
    for (const name of names) {
      // A Unicode name always wins over an alias, so "United Kingdom" cannot be
      // shadowed by an alias someone adds for a constituent country.
      if (!out.has(name.toLowerCase())) out.set(name.toLowerCase(), code);
    }
  }
  return out;
})();

/** Every country, alphabetically by English name. */
export function allCountries(): Country[] {
  return [...CODE_TO_NAME.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Is this a code we can name? Case-insensitive; `"us"` is a US player's code. */
export function isCountryCode(value: unknown): boolean {
  return typeof value === "string" && CODE_TO_NAME.has(value.trim().toUpperCase());
}

/** `"us"` → `"US"`, or null when it is not a country code at all. */
export function normaliseCountryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CODE_TO_NAME.has(code) ? code : null;
}

/** `"US"` → `"United States"`. Null for anything we cannot name. */
export function countryNameFor(value: unknown): string | null {
  const code = normaliseCountryCode(value);
  return code ? (CODE_TO_NAME.get(code) ?? null) : null;
}

/** `"United States"` → `"US"`, `"USA"` → `"US"`. Null when unrecognised. */
export function countryCodeForName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return NAME_TO_CODE.get(value.trim().toLowerCase()) ?? null;
}

/**
 * Which of the catalog's own country names this code means.
 *
 * Matched against the names actually present rather than asserted, so the
 * caller can tell "the squad is in a country this catalog covers" from "the
 * squad is in a country nothing has been collected for" — and say the
 * difference out loud instead of showing an empty list.
 *
 * Returns every match: one country can appear under more than one spelling
 * across sources, and filtering on all of them is right.
 */
export function catalogCountriesForCode(code: unknown, catalogNames: Iterable<string>): string[] {
  const wanted = normaliseCountryCode(code);
  if (!wanted) return [];
  const out: string[] = [];
  for (const name of catalogNames) {
    if (countryCodeForName(name) === wanted) out.push(name);
  }
  return out;
}
