import { Router } from "express";
import { z } from "zod";
import type { Prisma, Tournament, PlayerTournament, User } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler, requireAuth, ok, HttpError, type AuthedRequest } from "../http";
import { requireRole, readablePlayerIds, assertCanActOnPlayer, getRole } from "../authz";
import { createAndDeliverNotification } from "../notifications/deliver";
import { importTournaments } from "./feed";
import {
  catalogCountriesForCode,
  countryCodeForName,
  countryNameFor,
  normaliseCountryCode,
} from "../lib/countries";
import { ageFromIsoDate, todayUtc } from "../auth/age";

export const tournamentsRouter = Router();

tournamentsRouter.use(requireAuth);

const STATUSES = ["planned", "registered", "maybe", "withdrawn", "played"] as const;

const addSchema = z.object({
  tournamentId: z.string().min(1),
  status: z.enum(STATUSES).default("registered"),
  notes: z.string().optional(),
  /**
   * Who the entry is for. Omitted means the caller.
   *
   * This used to be accepted and IGNORED — every entry was filed under whoever
   * was signed in — so a coach could not enter a player at all, which is most
   * of what planning a junior's season consists of. A coach may now name a
   * player they are allowed to act on; anyone else naming someone else is
   * refused by `assertCanActOnPlayer`, exactly as when booking a session.
   */
  playerId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  notes: z.string().optional(),
});

/** Map a Tournament row to the front-end shape (ISO dates, nulls → undefined). */
function presentTournament(t: Tournament) {
  return {
    id: t.id,
    name: t.name,
    city: t.city,
    country: t.country,
    surface: t.surface,
    indoorOutdoor: t.indoorOutdoor as "indoor" | "outdoor",
    altitude: t.altitude ?? undefined,
    ballBrand: t.ballBrand ?? undefined,
    weatherSummary: t.weatherSummary ?? undefined,
    category: t.category ?? undefined,
    level: t.level ?? undefined,
    // Coordinates power the tournaments map + distance sort. Contract shape is
    // `number | null` (explicit null, not undefined) so the client can tell
    // "no coordinates" from "field omitted".
    latitude: t.latitude ?? null,
    longitude: t.longitude ?? null,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    description: t.description ?? undefined,
    // Collected by the feeds and, until now, never sent to the client — so the
    // one date a coach can actually miss was invisible in the app that holds it.
    entryDeadline: t.entryDeadline?.toISOString(),
    ageCategory: t.ageCategory ?? undefined,
    venue: t.venue ?? undefined,
    website: t.website ?? undefined,
    registeredCount: t.registeredCount ?? undefined,
    utrRangeMin: t.utrRangeMin ?? undefined,
    utrRangeMax: t.utrRangeMax ?? undefined,
    source: t.source ?? undefined,
    // Freshness. `lastSeenAt` is when the feed last confirmed the event; a stale
    // value means the source stopped listing it. `updatedAt` moves on any write
    // (a coach setting the ball included), so the client uses it only for rows
    // no feed produced.
    lastSeenAt: t.lastSeenAt?.toISOString(),
    // Optional chaining on a non-null column on purpose: an embedded tournament
    // on a player-entry row is only as complete as the query that fetched it.
    updatedAt: t.updatedAt?.toISOString(),
    federation: (t.federation ?? undefined) as
      | "ITF"
      | "WTA"
      | "ATP"
      | "UTR"
      | "USTA"
      | undefined,
  };
}

/**
 * Tell a player their coach put an event on their calendar.
 *
 * Fire-and-forget, and shared by the two routes that can do it — the ordinary
 * entry and a coach entering a player for an event they just typed in. One
 * function so the two cannot drift into telling the player different things
 * about the same act. A failure to notify must never fail the entry itself.
 */
function notifyPlayerOfEntry(
  playerId: string,
  name: string,
  city: string,
  startDate: Date,
): Promise<void> {
  const when = startDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return createAndDeliverNotification(prisma, {
    userId: playerId,
    type: "tournament_entry_added",
    title: "Tournament added to your calendar",
    message: `Your coach entered you for ${name} in ${city} — ${when}.`,
    linkTo: "/tournaments",
  })
    .then(() => undefined)
    .catch((err) => {
      console.error(
        `[tournaments] entry notification for ${playerId} failed:`,
        err instanceof Error ? err.message : err,
      );
    });
}

type PTWithRelations = PlayerTournament & { tournament: Tournament; player: User };

/** Map a PlayerTournament row (with relations) to the embedded front-end shape. */
function presentPlayerTournament(pt: PTWithRelations) {
  return {
    id: pt.id,
    tournamentId: pt.tournamentId,
    tournament: presentTournament(pt.tournament),
    playerId: pt.playerId,
    playerName: `${pt.player.firstName} ${pt.player.lastName}`,
    status: pt.status as (typeof STATUSES)[number],
    notes: pt.notes ?? undefined,
  };
}

// GET /api/tournaments — the global catalog.
/**
 * How much of the calendar to return when the caller does not say.
 *
 * This used to return every row, which was fine at 26 curated events and is not
 * at 3,278 live ones: 1.13 MB and four seconds on every calendar and tournaments
 * page load. A season either side covers planning — a coach entering a player
 * for something three years out is not a case worth making everyone else pay
 * for — and `from`/`to` are there for anyone who does need further.
 */
const DEFAULT_PAST_DAYS = 60;
const DEFAULT_FUTURE_DAYS = 365;
/** A ceiling even on an explicit range, so one request cannot pull everything. */
const MAX_ROWS = 2000;
/** Deep enough to page through anything this catalog will hold. */
const MAX_OFFSET = 100_000;
/** How many values one facet may be filtered on at once. */
const MAX_FACET_VALUES = 60;
/**
 * Marks a row as typed in by a person rather than collected. Read by the list
 * query as well as the write, so it lives up here with the other constants.
 */
const COACH_ENTERED_SOURCE = "coach-entered";

/**
 * A facet the client may filter on, repeatable: `?country=Spain&country=France`.
 *
 * Repeatable because the page's DEFAULT is a set — a coach whose players are in
 * two countries wants both — and because a subscription to three tours is three
 * federations, not one. Express hands a repeated parameter over as an array, so
 * both shapes arrive here and both become a `string[]`.
 */
function facet(name: string) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const values = (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
      return values.length === 0 ? undefined : values.slice(0, MAX_FACET_VALUES);
    })
    .describe(name);
}

/**
 * What the catalog list accepts.
 *
 * It used to accept `from`, `to` and `limit` only, and sent up to 2,000 rows
 * filtered by date alone for the browser to sieve through all six facets
 * itself. Every facet is now a query parameter and the results are paged, so a
 * coach looking at 40 US clay events downloads 40 rows rather than a season of
 * the whole world.
 */
const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  /**
   * Free text across the name, host city and country — the page's search box.
   *
   * It has to be here rather than in the browser now that the list is paged: a
   * search that only looked at the 48 rows on screen would answer "no results"
   * for an event three pages down.
   */
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(MAX_ROWS).optional(),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional(),
  country: facet("country"),
  federation: facet("federation"),
  surface: facet("surface"),
  category: facet("category"),
  level: facet("level"),
});

type ListQuery = z.infer<typeof listQuery>;

/** The date overlap every catalog query shares. */
function windowWhere(query: { from?: string; to?: string }) {
  const { gte, lte } = windowFrom(query);
  // An event that STARTED before the window but is still running is still
  // current, so the overlap is tested rather than just the start date.
  return { startDate: { lte }, endDate: { gte } };
}

/**
 * Window plus whichever facets the caller named.
 *
 * A facet nobody filtered on contributes nothing, so an unfiltered request is
 * byte-for-byte the query it always was — which is what keeps the calendar, the
 * command palette and the tournament detail page working unchanged.
 */
function listWhere(query: ListQuery): Prisma.TournamentWhereInput {
  // Two of these clauses are an OR of their own and a where object has only one
  // `OR` key, so they are collected into an AND rather than overwriting each
  // other.
  const and: Prisma.TournamentWhereInput[] = [];

  if (query.federation) {
    // A hand-entered event is stored with no sanctioning body on purpose:
    // nothing here knows which one runs it, and a badge nobody earned is worse
    // than none. But that must not mean it disappears the moment a tour filter
    // is on — a coach who adds an event and then filters to his own tour would
    // watch his own row vanish from the list while it sat on the player's
    // schedule, which reads as "it did not save". So his entries survive a tour
    // filter alongside the rows that do claim one.
    and.push({
      OR: [{ federation: { in: query.federation } }, { source: COACH_ENTERED_SOURCE }],
    });
  }

  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { city: { contains: query.q, mode: "insensitive" } },
        { country: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }

  return {
    ...windowWhere(query),
    ...(query.country ? { country: { in: query.country } } : {}),
    ...(query.surface ? { surface: { in: query.surface } } : {}),
    ...(query.category ? { category: { in: query.category } } : {}),
    ...(query.level ? { level: { in: query.level } } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

function windowFrom(query: { from?: string; to?: string }): { gte: Date; lte: Date } {
  const day = 86_400_000;
  const parse = (value: string | undefined, fallback: number): Date => {
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(Date.now() + fallback);
  };
  return {
    gte: parse(query.from, -DEFAULT_PAST_DAYS * day),
    lte: parse(query.to, DEFAULT_FUTURE_DAYS * day),
  };
}

tournamentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    const rows = await prisma.tournament.findMany({
      where: listWhere(query),
      // `id` breaks the tie so paging is stable: hundreds of events share a
      // start date, and without a second key the same row can appear on two
      // pages while another appears on none.
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      skip: query.offset ?? 0,
      take: query.limit ?? MAX_ROWS,
    });
    return ok(res, rows.map(presentTournament));
  }),
);

// ── GET /api/tournaments/facets — what there is to filter BY ───────────────
//
// The page used to build its filter dropdowns from the rows it happened to be
// holding. With the list now paged that is untenable: 48 rows would offer three
// countries, and every choice a coach made would shrink the choices left. So
// the option lists are aggregated over the whole date window, independent of
// which facets are currently selected — pick "Clay" and the country list does
// not change.
//
// `total` is the window; `matching` is the window with the caller's filters
// applied, which is what "showing 48 of 312" needs.

/** Sources that actually go and collect. The rest are typed in by a person. */
const COLLECTING_SOURCES = new Set(["utr-events", "itf-juniors", "http-live"]);

const facetsQuery = listQuery;

/** One option: its value, how many events carry it. */
function tally<K extends string>(
  rows: Array<Record<K, string | null> & { _count: { _all: number } }>,
  key: K,
): Array<{ value: string; count: number }> {
  return rows
    .filter((r) => typeof r[key] === "string" && (r[key] as string).length > 0)
    .map((r) => ({ value: r[key] as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

tournamentsRouter.get(
  "/facets",
  asyncHandler(async (req, res) => {
    const query = facetsQuery.parse(req.query);
    const where = windowWhere(query);
    const count = { _all: true } as const;

    const [countries, federationSources, surfaces, categories, levels, total, matching, withAgeBand] =
      await Promise.all([
        prisma.tournament.groupBy({ by: ["country"], where, _count: count }),
        // BY SOURCE as well as federation, on purpose. A count alone would
        // advertise ATP as covered: it has 19 events and every one of them is a
        // hand-typed row in the curated snapshot that nothing refreshes. What a
        // coach needs to know is whether anything is COLLECTING that tour.
        prisma.tournament.groupBy({ by: ["federation", "source"], where, _count: count }),
        prisma.tournament.groupBy({ by: ["surface"], where, _count: count }),
        prisma.tournament.groupBy({ by: ["category"], where, _count: count }),
        prisma.tournament.groupBy({ by: ["level"], where, _count: count }),
        prisma.tournament.count({ where }),
        prisma.tournament.count({ where: listWhere(query) }),
        prisma.tournament.count({ where: { ...where, ageCategory: { not: null } } }),
      ]);

    // Fold the (federation, source) pairs back into one row per federation,
    // keeping whether any of its sources is a collector.
    const byFederation = new Map<string, { count: number; collected: boolean; sources: Set<string> }>();
    for (const row of federationSources) {
      const federation = row.federation;
      if (!federation) continue;
      const entry = byFederation.get(federation) ?? { count: 0, collected: false, sources: new Set() };
      entry.count += row._count._all;
      const source = row.source ?? "manual";
      entry.sources.add(source);
      if (COLLECTING_SOURCES.has(source)) entry.collected = true;
      byFederation.set(federation, entry);
    }

    return ok(res, {
      total,
      matching,
      countries: tally(countries, "country").map((c) => ({
        ...c,
        // So a client can match a player's home-country code to this option
        // without shipping its own copy of the world.
        code: countryCodeForName(c.value),
      })),
      federations: [...byFederation.entries()]
        .map(([value, entry]) => ({
          value,
          count: entry.count,
          /** True when a live source is collecting this tour. */
          collected: entry.collected,
          sources: [...entry.sources].sort(),
        }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      surfaces: tally(surfaces, "surface"),
      categories: tally(categories, "category"),
      levels: tally(levels, "level"),
      /**
       * How many events in the window publish an age band at all. Zero on
       * every run so far, which is why the scope below cannot narrow by age —
       * read off the data rather than asserted, so it starts working by itself
       * the day a source begins publishing one.
       */
      eventsWithAgeBand: withAgeBand,
    });
  }),
);

// ── GET /api/tournaments/scope — what this viewer's page should open on ────
//
// "It shouldn't show all tournaments, just base on the filter and what user is
// chosen." A player's page opens on their own country; a coach's opens on the
// countries their players compete in. The server decides it because the server
// is what holds the profiles and what is allowed to read them.
//
// It also reports what it COULD NOT work out, and why. A coach whose players
// have no home country must be told that, offered somewhere to set it, and left
// looking at everything — not dropped onto a blank page or silently handed all
// 3,218 rows as though that were the answer.

/** Age bands a junior calendar is organised into. */
const AGE_BANDS = [10, 12, 14, 16, 18] as const;

/** "U14" for a 13-year-old, "Adult" past the last band. */
export function ageBandFor(age: number): string {
  for (const band of AGE_BANDS) if (age < band) return `U${band}`;
  return "Adult";
}

tournamentsRouter.get(
  "/scope",
  asyncHandler(async (req: AuthedRequest, res) => {
    const query = facetsQuery.parse(req.query);
    const where = windowWhere(query);

    const [role, readable] = await Promise.all([
      getRole(req.userId!),
      readablePlayerIds(req.userId!),
    ]);
    // A coach's own id comes back from `readablePlayerIds` along with their
    // players'. The scope is about who COMPETES, so for anyone who is not a
    // player themselves their own row is not one of the players considered.
    const playerIds = role === "player" ? readable : readable.filter((id) => id !== req.userId);

    const profiles = playerIds.length
      ? await prisma.playerProfile.findMany({
          where: { userId: { in: playerIds } },
          select: { userId: true, homeCountry: true, dateOfBirth: true },
        })
      : [];

    const codes = [
      ...new Set(profiles.map((p) => normaliseCountryCode(p.homeCountry)).filter((c): c is string => c !== null)),
    ].sort();

    // Which of the catalog's own country spellings those codes mean. Matched
    // against what is actually there, so "nobody has set one" and "we collect
    // nothing where they play" are different answers and the page can say which.
    const catalogCountries = codes.length
      ? (await prisma.tournament.groupBy({ by: ["country"], where, _count: { _all: true } }))
          .map((r) => r.country)
          .filter((c): c is string => typeof c === "string")
      : [];

    const countries = [...new Set(codes.flatMap((code) => catalogCountriesForCode(code, catalogCountries)))].sort();
    const unmatched = codes.filter((code) => catalogCountriesForCode(code, catalogCountries).length === 0);

    const today = todayUtc();
    const bands = [
      ...new Set(
        profiles
          .map((p) => (p.dateOfBirth ? ageFromIsoDate(p.dateOfBirth, today) : null))
          .filter((age): age is number => age !== null)
          .map(ageBandFor),
      ),
    ].sort();

    const eventsWithAgeBand = await prisma.tournament.count({
      where: { ...where, ageCategory: { not: null } },
    });

    const reason =
      playerIds.length === 0
        ? "no-players"
        : codes.length === 0
          ? "no-home-country"
          : countries.length === 0
            ? "unmatched"
            : "ok";

    return ok(res, {
      role,
      /** The country names to filter on. Empty means no default can be computed. */
      countries,
      /** The codes behind them, and their names, so the page can name what it is missing. */
      countryCodes: codes.map((code) => ({ code, name: countryNameFor(code) })),
      /** Codes that resolved to no catalog country — nothing is collected there. */
      unmatchedCountryCodes: unmatched.map((code) => ({ code, name: countryNameFor(code) })),
      playersReadable: playerIds.length,
      playersWithHomeCountry: codes.length,
      /**
       * Which readable players have not said where they compete.
       *
       * Ids only — the caller already knows the names of everyone they may
       * read, and sending them again from here would widen what this endpoint
       * discloses for no gain. It exists so the page's empty state can offer
       * "set it" for the actual players who are missing one, rather than
       * sending a coach off to hunt through profiles.
       */
      missingHomeCountry: profiles
        .filter((p) => normaliseCountryCode(p.homeCountry) === null)
        .map((p) => p.userId)
        .concat(playerIds.filter((id) => !profiles.some((p) => p.userId === id)))
        .sort(),
      /** `ok` | `no-players` | `no-home-country` | `unmatched` */
      reason,
      /**
       * The squad's age bands, and why they are not applied.
       *
       * They are not applied because no event has one to compare against:
       * `ageCategory` was null on all 3,241 rows in the live catalog, and UTR's
       * `ageRange` was null on all 100 events sampled. Reporting the band and
       * the reason is the honest version of a filter that would otherwise
       * silently reduce the page to nothing.
       */
      ageBands: {
        bands,
        applied: false,
        reason: eventsWithAgeBand === 0 ? "not-published" : "not-supported",
        eventsWithAgeBand,
      },
    });
  }),
);

// ── POST /api/tournaments — a coach types one in ───────────────────────────
//
// This is the answer to "there is only one USTA tournament". UTR carries no
// sanctioning body and no USTA calendar, and USTA's own site refuses this
// client in its robots.txt — it names ClaudeBot and
// CloudflareBrowserRenderingCrawler and disallows both, and makes abiding by
// those signals a condition of access — so there is no collector for it and
// will not be one until the owner has permission in hand. Until then a coach
// enters the event they know about, once, and it behaves like any other row.
//
// It is NOT added to the curated snapshot. Hand-typing more rows into the
// source code is what produced the single USTA event in the first place; the
// difference here is that a coach owns their own entry and can fix it.

/**
 * The surfaces the app knows. Same vocabulary the feeds are normalised into
 * (see `normaliseSurface`), including "Unknown" — a coach who has not been told
 * the surface should be able to say so rather than guess at Hard.
 */
const SURFACES = ["Hard", "Clay", "Grass", "Carpet", "Unknown"] as const;

/** A date this app will accept for a tournament: real, and this century-ish. */
const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "Not a date" });

const createTournamentSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    city: z.string().trim().min(1).max(120),
    /**
     * An ISO 3166-1 alpha-2 code, not a name. The client picks from
     * /api/countries and the server stores the English name the feeds use, so a
     * coach working in Spanish cannot file an event under "Estados Unidos" and
     * split the country facet in two.
     */
    country: z.string().trim().refine((v) => normaliseCountryCode(v) !== null, {
      message: "country must be an ISO 3166-1 alpha-2 code, e.g. US",
    }),
    startDate: isoDate,
    endDate: isoDate,
    surface: z.enum(SURFACES),
    // The column is NOT NULL and the app shows it on every card. Asking is one
    // radio button; defaulting to "outdoor" would be a guess presented as fact.
    indoorOutdoor: z.enum(["indoor", "outdoor"]),
    level: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    entryDeadline: isoDate.optional(),
    /**
     * http(s) only, and the scheme is checked rather than assumed.
     *
     * `z.string().url()` accepts `javascript:alert(1)` — it validates URL
     * syntax, not URL safety — and the tournament detail page renders this
     * straight into an `href`. That is stored XSS from a form a coach can
     * reach, so the scheme is pinned here at the only place a person can write
     * this column. (The client refuses a non-http href as well; a link this
     * app did not write should not be trusted either.)
     */
    website: z
      .string()
      .trim()
      .url()
      .max(500)
      .refine(
        (v) => {
          try {
            const protocol = new URL(v).protocol;
            return protocol === "http:" || protocol === "https:";
          } catch {
            return false;
          }
        },
        { message: "The link must be an http:// or https:// address" },
      )
      .optional(),
    /**
     * Enter a player at the same time. This is the whole point for a coach: the
     * event exists so that it lands on somebody's schedule and in their
     * next-tournament countdown.
     */
    playerId: z.string().min(1).optional(),
  })
  .refine((d) => new Date(d.endDate).getTime() >= new Date(d.startDate).getTime(), {
    message: "endDate cannot be before startDate",
    path: ["endDate"],
  })
  .refine((d) => Boolean(d.level ?? d.category), {
    message: "Give at least a level or a category, so the event can be told apart from the rest",
    path: ["category"],
  });

tournamentsRouter.post(
  "/",
  requireRole("coach", "admin"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const d = createTournamentSchema.parse(req.body);

    // Checked before anything is written, so a refused entry does not leave an
    // orphan tournament in the shared catalog.
    if (d.playerId) await assertCanActOnPlayer(req.userId!, d.playerId);

    const created = await prisma.tournament.create({
      data: {
        name: d.name,
        city: d.city,
        country: countryNameFor(d.country)!,
        surface: d.surface,
        indoorOutdoor: d.indoorOutdoor,
        level: d.level ?? null,
        category: d.category ?? null,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        entryDeadline: d.entryDeadline ? new Date(d.entryDeadline) : null,
        website: d.website ?? null,
        // No sanctioning body is claimed. Nothing here knows whether the event
        // is USTA-sanctioned, and inventing a federation is exactly the kind of
        // unearned label that made the calendar untrustworthy.
        federation: null,
        // `source` is what keeps it safe from the feeds: `pruneStale` only ever
        // deletes rows whose `source` is the provider that just ran, so a row
        // stamped "coach-entered" is never a stale feed row. It is also what
        // the provenance chip reads to show it as hand-entered.
        source: COACH_ENTERED_SOURCE,
        sourceUrl: null,
        // Deliberately null: no feed has confirmed this event, and a timestamp
        // here would make the chip claim a freshness check that never happened.
        lastSeenAt: null,
      },
    });

    // One entry for the named player, through the same upsert the ordinary
    // entry route uses, so status and idempotency behave identically.
    if (d.playerId) {
      await prisma.playerTournament.upsert({
        where: { tournamentId_playerId: { tournamentId: created.id, playerId: d.playerId } },
        update: { status: "planned" },
        create: { tournamentId: created.id, playerId: d.playerId, status: "planned" },
      });

      // Same rule as the ordinary entry route: something put on your calendar
      // by somebody else is news, and the person who did it is not told.
      if (d.playerId !== req.userId) {
        void notifyPlayerOfEntry(d.playerId, created.name, created.city, created.startDate);
      }
    }

    return ok(res, presentTournament(created), "Tournament added", 201);
  }),
);

// POST /api/tournaments/import — admin-only. Pulls tournaments from the active
// feed provider (curated static snapshot, or a real live feed when configured)
// and upserts them into the catalog. Idempotent.
tournamentsRouter.post(
  "/import",
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const result = await importTournaments(prisma);
    return ok(res, result, `Imported ${result.imported} tournaments from ${result.source}`);
  }),
);

export const playerTournamentsRouter = Router();
playerTournamentsRouter.use(requireAuth);

// GET /api/player-tournaments — the current user's tournament entries.
playerTournamentsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    // Everyone the caller may read, not just themselves. Scoped to the caller
    // for a player; a coach or guardian sees their players' entries too, which
    // is the whole point of the coach's tournament view — it was returning an
    // empty list for every coach against the real API.
    const playerIds = await readablePlayerIds(req.userId!);
    const rows = await prisma.playerTournament.findMany({
      where: { playerId: { in: playerIds } },
      include: { tournament: true, player: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, rows.map(presentPlayerTournament));
  }),
);

// POST /api/player-tournaments — register the current user for a tournament.
playerTournamentsRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = addSchema.parse(req.body);

    const tournament = await prisma.tournament.findUnique({ where: { id: data.tournamentId } });
    if (!tournament) throw new HttpError(404, "Tournament not found");

    // Default to the caller; a coach may name a connected player instead.
    const playerId = data.playerId ?? req.userId!;
    await assertCanActOnPlayer(req.userId!, playerId);

    // One entry per (tournament, player) — upsert keeps it idempotent.
    const pt = await prisma.playerTournament.upsert({
      where: { tournamentId_playerId: { tournamentId: data.tournamentId, playerId } },
      update: { status: data.status, notes: data.notes },
      create: {
        tournamentId: data.tournamentId,
        playerId,
        status: data.status,
        notes: data.notes,
      },
      include: { tournament: true, player: true },
    });

    // A tournament put on someone's calendar by somebody else is exactly the
    // kind of thing they should hear about rather than discover. Never notify
    // the person who did it.
    if (playerId !== req.userId) {
      void notifyPlayerOfEntry(playerId, tournament.name, tournament.city, tournament.startDate);
    }

    return ok(res, presentPlayerTournament(pt), "Tournament entry added", 201);
  }),
);

// PATCH /api/player-tournaments/:id — update status/notes (owner only).
playerTournamentsRouter.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = updateSchema.parse(req.body);

    const existing = await prisma.playerTournament.findUnique({
      where: { id: req.params.id },
      select: { playerId: true },
    });
    if (!existing) throw new HttpError(404, "Tournament entry not found");
    if (existing.playerId !== req.userId) throw new HttpError(403, "Not your tournament entry");

    const pt = await prisma.playerTournament.update({
      where: { id: req.params.id },
      data: { status: data.status, notes: data.notes },
      include: { tournament: true, player: true },
    });
    return ok(res, presentPlayerTournament(pt), "Tournament status updated");
  }),
);

// DELETE /api/player-tournaments/:id — remove a tournament from the schedule (owner only).
playerTournamentsRouter.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.playerTournament.findUnique({
      where: { id: req.params.id },
      select: { playerId: true },
    });
    if (!existing) throw new HttpError(404, "Tournament entry not found");
    if (existing.playerId !== req.userId) throw new HttpError(403, "Not your tournament entry");

    await prisma.playerTournament.delete({ where: { id: req.params.id } });
    return ok(res, null, "Removed from schedule");
  }),
);

// ── Hidden tournaments (per-user "eliminate from suggestions") ─────────────
// All routes are auth-required and strictly owner-scoped: a user can only read
// and mutate their OWN hidden list (scoped by req.userId, never a body/param id).
export const hiddenTournamentsRouter = Router();
hiddenTournamentsRouter.use(requireAuth);

const hideSchema = z.object({ tournamentId: z.string().min(1) });

// GET /api/hidden-tournaments — the tournamentIds the current user has hidden.
hiddenTournamentsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = await prisma.hiddenTournament.findMany({
      where: { userId: req.userId! },
      select: { tournamentId: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, rows.map((r) => r.tournamentId));
  }),
);

// POST /api/hidden-tournaments — hide a tournament for the current user.
// Idempotent: hiding an already-hidden tournament still returns 201.
hiddenTournamentsRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { tournamentId } = hideSchema.parse(req.body);

    // Guard against orphan hides + give a clean 404 (vs a raw FK error).
    const exists = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "Tournament not found");

    await prisma.hiddenTournament.upsert({
      where: { userId_tournamentId: { userId: req.userId!, tournamentId } },
      update: {},
      create: { userId: req.userId!, tournamentId },
    });
    return ok(res, { tournamentId }, "Tournament hidden from suggestions", 201);
  }),
);

// DELETE /api/hidden-tournaments/:tournamentId — unhide (idempotent: a no-op
// delete when the row is absent still returns 200).
hiddenTournamentsRouter.delete(
  "/:tournamentId",
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.hiddenTournament.deleteMany({
      where: { userId: req.userId!, tournamentId: req.params.tournamentId },
    });
    return ok(res, null, "Tournament restored to suggestions");
  }),
);
