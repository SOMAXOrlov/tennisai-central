// The filters have to reach the server, and a repeated value has to stay a
// repeated value: a squad in two countries is `?country=A&country=B`, not
// `?country=A,B`, which the server would read as one country nothing matches.

import { describe, it, expect } from "vitest";
import { tournamentQueryString } from "../tournaments";

describe("tournamentQueryString", () => {
  it("is empty when nothing is filtered", () => {
    expect(tournamentQueryString()).toBe("");
    expect(tournamentQueryString({})).toBe("");
  });

  it("repeats a parameter for each value rather than joining them", () => {
    const qs = tournamentQueryString({ country: ["Spain", "France"] });
    expect(qs).toBe("?country=Spain&country=France");
  });

  it("encodes a value with spaces", () => {
    expect(tournamentQueryString({ country: ["United States"] })).toBe("?country=United+States");
  });

  it("carries the paging and the search alongside the facets", () => {
    const qs = tournamentQueryString({ q: "lisbon", limit: 48, offset: 96, surface: ["Clay"] });
    expect(qs).toContain("q=lisbon");
    expect(qs).toContain("limit=48");
    expect(qs).toContain("offset=96");
    expect(qs).toContain("surface=Clay");
  });

  it("drops an empty value instead of sending a filter on nothing", () => {
    // `?country=` would be read as a filter for the empty-string country, and
    // the page would go blank on a cleared dropdown.
    expect(tournamentQueryString({ country: [], surface: [""] })).toBe("");
    expect(tournamentQueryString({ q: undefined })).toBe("");
  });
});
