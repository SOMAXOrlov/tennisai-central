import type { Tournament, PlayerTournament, ApiResponse } from "@/types";
import { apiClient } from "@/api/client";
import { mockStore } from "@/mock/store";
import { mockTournaments } from "@/mock/data";
import { mapTournaments } from "@/api/mappers/tournamentFederation";

// Tournaments are migrated to the real backend (server/src/tournaments). Live
// whenever an absolute API base is configured; otherwise the in-memory mock is
// used for offline frontend work and tests.
const LIVE_API = Boolean(import.meta.env.VITE_API_BASE_URL);
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/**
 * How the catalog is narrowed — SERVER-side.
 *
 * The page used to fetch a season of the whole world and sieve it in the
 * browser. Every field here becomes a query parameter, and the arrays are sent
 * as a repeated parameter (`?country=Spain&country=France`) because a squad can
 * compete in more than one country and a subscription can cover more than one
 * tour.
 */
export interface TournamentQuery {
  from?: string;
  to?: string;
  /** Free text across name, city and country — the page search box. */
  q?: string;
  limit?: number;
  offset?: number;
  country?: string[];
  federation?: string[];
  surface?: string[];
  category?: string[];
  level?: string[];
}

/** One value a facet can take, and how many events in the window carry it. */
export interface FacetOption {
  value: string;
  count: number;
}

/** A country option, with the ISO code that matches a player's home country. */
export interface CountryFacetOption extends FacetOption {
  code: string | null;
}

/** A tour option, and whether anything is actually collecting it. */
export interface FederationFacetOption extends FacetOption {
  /**
   * False when every event on this tour is a hand-typed snapshot row. ATP has
   * seven and USTA has one; presenting those as covered calendars is what made
   * the owner distrust the data, so the page says which is which.
   */
  collected: boolean;
  sources: string[];
}

export interface TournamentFacets {
  /** Events in the date window, before any facet filter. */
  total: number;
  /** Events matching the filters the caller sent. */
  matching: number;
  countries: CountryFacetOption[];
  federations: FederationFacetOption[];
  surfaces: FacetOption[];
  categories: FacetOption[];
  levels: FacetOption[];
  /** How many events publish an age band. Zero on every run so far. */
  eventsWithAgeBand: number;
}

/** Whether the page could work out a default scope, and if not, why not. */
export type ScopeReason = "ok" | "no-players" | "no-home-country" | "unmatched";

export interface TournamentScope {
  role: string;
  /** Catalog country names to open on. Empty means no default is available. */
  countries: string[];
  countryCodes: Array<{ code: string; name: string | null }>;
  /** Codes that matched no country in the catalog — nothing is collected there. */
  unmatchedCountryCodes: Array<{ code: string; name: string | null }>;
  playersReadable: number;
  playersWithHomeCountry: number;
  /** Readable players who have not said where they compete — ids only. */
  missingHomeCountry?: string[];
  reason: ScopeReason;
  ageBands: {
    bands: string[];
    applied: boolean;
    reason: string;
    eventsWithAgeBand: number;
  };
}

/** What a coach fills in to add an event no feed carries. */
export interface NewTournament {
  name: string;
  city: string;
  /** ISO 3166-1 alpha-2. The server stores the country name the feeds use. */
  country: string;
  startDate: string;
  endDate: string;
  surface: string;
  indoorOutdoor: "indoor" | "outdoor";
  level?: string;
  category?: string;
  entryDeadline?: string;
  website?: string;
  /** Enter this player at the same time, so it lands on their schedule. */
  playerId?: string;
}

/** `{ country: ["A","B"] }` → `?country=A&country=B`, skipping empty values. */
export function tournamentQueryString(query: TournamentQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * The mock's answer to a filtered query.
 *
 * Applied rather than ignored: a filter that silently does nothing in mock mode
 * is a filter no test can catch, and the tests run in mock mode.
 */
function filterMock(rows: Tournament[], query: TournamentQuery): Tournament[] {
  const has = (values: string[] | undefined, value: string | undefined) =>
    !values || values.length === 0 || (value !== undefined && values.includes(value));
  const needle = query.q?.trim().toLowerCase() ?? "";
  const matchesText = (t: Tournament) =>
    !needle ||
    t.name.toLowerCase().includes(needle) ||
    t.city.toLowerCase().includes(needle) ||
    t.country.toLowerCase().includes(needle);
  const matched = rows.filter(
    (t) =>
      matchesText(t) &&
      has(query.country, t.country) &&
      has(query.federation, t.federation) &&
      has(query.surface, t.surface) &&
      has(query.category, t.category) &&
      has(query.level, t.level),
  );
  const offset = query.offset ?? 0;
  return matched.slice(offset, query.limit === undefined ? undefined : offset + query.limit);
}

/** Facet option lists over a whole row set — the mock's aggregate. */
function facetsFromMock(rows: Tournament[], query: TournamentQuery): TournamentFacets {
  const countOf = (pick: (t: Tournament) => string | undefined): FacetOption[] => {
    const tally = new Map<string, number>();
    for (const t of rows) {
      const value = pick(t);
      if (value) tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  return {
    total: rows.length,
    matching: filterMock(rows, { ...query, limit: undefined, offset: undefined }).length,
    countries: countOf((t) => t.country).map((c) => ({ ...c, code: null })),
    federations: countOf((t) => t.federation).map((f) => ({
      ...f,
      collected: true,
      sources: ["mock"],
    })),
    surfaces: countOf((t) => t.surface),
    categories: countOf((t) => t.category),
    levels: countOf((t) => t.level),
    eventsWithAgeBand: rows.filter((t) => Boolean(t.ageCategory)).length,
  };
}

export const tournamentsApi = {
  async getTournaments(query: TournamentQuery = {}): Promise<ApiResponse<Tournament[]>> {
    if (!LIVE_API) {
      await delay();
      const rows = JSON.parse(JSON.stringify(mockTournaments)) as Tournament[];
      return { data: filterMock(rows, query) };
    }
    const raw = await apiClient.get<unknown>(`/tournaments${tournamentQueryString(query)}`);
    return { data: mapTournaments(raw) };
  },

  async getFacets(query: TournamentQuery = {}): Promise<ApiResponse<TournamentFacets>> {
    if (!LIVE_API) {
      await delay();
      const rows = JSON.parse(JSON.stringify(mockTournaments)) as Tournament[];
      return { data: facetsFromMock(rows, query) };
    }
    return apiClient.get(`/tournaments/facets${tournamentQueryString(query)}`);
  },

  async getScope(): Promise<ApiResponse<TournamentScope>> {
    if (!LIVE_API) {
      await delay();
      // The mock holds no profiles, so it answers what the real server answers
      // when nobody has said where they compete — which is the state the page
      // most needs to handle well.
      return {
        data: {
          role: "player",
          countries: [],
          countryCodes: [],
          unmatchedCountryCodes: [],
          playersReadable: 0,
          playersWithHomeCountry: 0,
          missingHomeCountry: [],
          reason: "no-home-country",
          ageBands: { bands: [], applied: false, reason: "not-published", eventsWithAgeBand: 0 },
        },
      };
    }
    return apiClient.get("/tournaments/scope");
  },

  async createTournament(data: NewTournament): Promise<ApiResponse<Tournament>> {
    if (!LIVE_API) {
      await delay();
      return {
        data: { ...data, id: `mock-${Date.now()}` } as unknown as Tournament,
        message: "Tournament added (mock)",
      };
    }
    return apiClient.post("/tournaments", data);
  },

  async getPlayerTournaments(): Promise<ApiResponse<PlayerTournament[]>> {
    if (!LIVE_API) { await delay(); return { data: mockStore.getPlayerTournaments() }; }
    return apiClient.get("/player-tournaments");
  },

  async addPlayerTournament(data: Omit<PlayerTournament, "id">): Promise<ApiResponse<PlayerTournament>> {
    if (!LIVE_API) { await delay(); return { data: mockStore.addPlayerTournament(data), message: "Tournament entry added" }; }
    return apiClient.post("/player-tournaments", data);
  },

  async updatePlayerTournament(id: string, data: Partial<PlayerTournament>): Promise<ApiResponse<PlayerTournament>> {
    if (!LIVE_API) { await delay(); return { data: mockStore.updatePlayerTournament(id, data), message: "Tournament status updated" }; }
    return apiClient.patch(`/player-tournaments/${id}`, data);
  },

  async removePlayerTournament(id: string): Promise<ApiResponse<null>> {
    if (!LIVE_API) { await delay(); return { data: null, message: "Removed from schedule (mock)" }; }
    return apiClient.delete(`/player-tournaments/${id}`);
  },
};

// ── Where a player competes ────────────────────────────────────────────────

export interface Country {
  code: string;
  name: string;
}

export interface HomeCountry {
  homeCountry: string | null;
  homeCountryName: string | null;
}

export const homeCountryApi = {
  async listCountries(): Promise<ApiResponse<Country[]>> {
    if (!LIVE_API) {
      await delay();
      // Enough to exercise the picker offline. The live list comes from the
      // server, which is also what validates the save, so a client cannot offer
      // a country the server would refuse.
      return {
        data: [
          { code: "AU", name: "Australia" },
          { code: "DE", name: "Germany" },
          { code: "ES", name: "Spain" },
          { code: "US", name: "United States" },
        ],
      };
    }
    return apiClient.get("/countries");
  },

  async get(playerId: string): Promise<ApiResponse<HomeCountry>> {
    if (!LIVE_API) { await delay(); return { data: { homeCountry: null, homeCountryName: null } }; }
    return apiClient.get(`/players/${playerId}/home-country`);
  },

  async save(playerId: string, homeCountry: string | null): Promise<ApiResponse<HomeCountry>> {
    if (!LIVE_API) {
      await delay();
      return { data: { homeCountry, homeCountryName: homeCountry }, message: "Saved (mock)" };
    }
    return apiClient.put(`/players/${playerId}/home-country`, { homeCountry });
  },
};
