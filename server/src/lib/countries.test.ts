// The translation between an ISO code on a profile and the country NAME the
// tournament catalog stores. Get this wrong and a squad's page scopes to
// nothing while looking like it worked, which is the failure the scope endpoint
// exists to make visible.

import { describe, it, expect } from "vitest";
import {
  allCountries,
  catalogCountriesForCode,
  countryCodeForName,
  countryNameFor,
  isCountryCode,
  normaliseCountryCode,
} from "./countries";

/** The 25 most common country names in the live catalog on 7 Sep 2026. */
const CATALOG_NAMES = [
  "United States",
  "Australia",
  "Mexico",
  "Canada",
  "Brazil",
  "Japan",
  "Portugal",
  "Argentina",
  "China",
  "Hong Kong",
  "Colombia",
  "India",
  "Germany",
  "Taiwan",
  "Indonesia",
  "Philippines",
  "Spain",
  "Thailand",
  "Vietnam",
  "United Arab Emirates",
  "Hungary",
  "Malaysia",
  "Ecuador",
  "Venezuela",
  "Ukraine",
];

describe("the country list", () => {
  it("covers the world without offering things that are not countries", () => {
    const codes = allCountries().map((c) => c.code);
    expect(codes.length).toBeGreaterThan(200);
    expect(codes).toContain("US");
    expect(codes).toContain("ES");
    expect(codes).toContain("AU");
    for (const grouping of ["EU", "EZ", "UN", "QO", "ZZ", "IC", "EA"]) {
      expect(codes, grouping).not.toContain(grouping);
    }
  });

  it("has no duplicate codes", () => {
    const codes = allCountries().map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives one country exactly one code", () => {
    // Unicode still names withdrawn codes, and names them the same as their
    // successor — "UK" and "GB" are both "United Kingdom". Two codes for one
    // country means a save can round-trip to the wrong one, so this is the
    // guard that keeps the withdrawn list complete.
    const names = allCountries().map((c) => c.name);
    const seen = new Map<string, number>();
    for (const name of names) seen.set(name, (seen.get(name) ?? 0) + 1);
    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });
});

describe("reading a code", () => {
  it("accepts a real code in any case and normalises it", () => {
    expect(normaliseCountryCode("us")).toBe("US");
    expect(normaliseCountryCode(" Es ")).toBe("ES");
    expect(isCountryCode("gb")).toBe(true);
  });

  it("refuses anything that is not one, rather than passing it through", () => {
    for (const bad of ["USA", "United States", "ZZ", "u", "", "  ", null, undefined, 12]) {
      expect(normaliseCountryCode(bad), String(bad)).toBeNull();
      expect(isCountryCode(bad), String(bad)).toBe(false);
    }
  });

  it("names a code the way the feeds do", () => {
    expect(countryNameFor("US")).toBe("United States");
    expect(countryNameFor("ES")).toBe("Spain");
    expect(countryNameFor("nope")).toBeNull();
    expect(countryNameFor(null)).toBeNull();
  });
});

describe("reading a name", () => {
  it("resolves every country name the live catalog actually contains", () => {
    // The measurement this whole module exists to satisfy: of the 54 distinct
    // country names in the catalog, three did not match a Unicode name and are
    // covered by the alias list. If a future name stops resolving, the scope
    // endpoint reports "unmatched" — but this test says so first.
    for (const name of CATALOG_NAMES) {
      expect(countryCodeForName(name), name).not.toBeNull();
    }
    expect(countryCodeForName("United States")).toBe("US");
    expect(countryCodeForName("Hong Kong")).toBe("HK");
  });

  it("accepts the spellings the feeds use as well as Unicode's", () => {
    expect(countryCodeForName("USA")).toBe("US");
    expect(countryCodeForName("UK")).toBe("GB");
    expect(countryCodeForName("Czech Republic")).toBe("CZ");
    expect(countryCodeForName("Turkey")).toBe("TR");
    expect(countryCodeForName("The Bahamas")).toBe("BS");
  });

  it("never lets an alias shadow a country's own name", () => {
    // "England" is an alias for GB; "United Kingdom" must still be GB and must
    // not be reachable only through the alias table.
    expect(countryCodeForName("United Kingdom")).toBe("GB");
    expect(countryCodeForName("England")).toBe("GB");
  });

  it("is case- and space-insensitive but does not guess", () => {
    expect(countryCodeForName("  united states ")).toBe("US");
    expect(countryCodeForName("Unite States")).toBeNull();
    expect(countryCodeForName("")).toBeNull();
    expect(countryCodeForName(null)).toBeNull();
  });
});

describe("matching a code against the catalog", () => {
  it("returns the catalog's own spelling, so the filter matches stored rows", () => {
    expect(catalogCountriesForCode("US", CATALOG_NAMES)).toEqual(["United States"]);
    expect(catalogCountriesForCode("hk", CATALOG_NAMES)).toEqual(["Hong Kong"]);
  });

  it("returns every spelling present, because sources word one country differently", () => {
    expect(catalogCountriesForCode("US", ["United States", "USA", "Spain"])).toEqual([
      "United States",
      "USA",
    ]);
  });

  it("returns nothing when the catalog covers no events there", () => {
    // The caller must be able to tell this from "matched" and say so on screen,
    // rather than filtering to an empty list that looks like a bug.
    expect(catalogCountriesForCode("NZ", CATALOG_NAMES)).toEqual([]);
    expect(catalogCountriesForCode("not-a-code", CATALOG_NAMES)).toEqual([]);
  });
});
