// Maps a raw tournament record from the API onto the client's `Tournament`.
//
// SANCTIONING BODY: READ, NEVER GUESSED
// This used to infer a federation when the record did not state one — matching
// "USTA", "ATP", "JUNIOR" and so on against the name, category and level, and
// falling back to "ITF" when nothing matched. Every row therefore arrived
// wearing a tour badge, whether or not anybody knew which tour ran the event.
//
// It also actively undid a decision made on the server. A tournament a coach
// types in is stored with NO federation on purpose, because nothing knows
// whether the event is USTA-sanctioned — and the old heuristic read the words
// "USTA Level 5" out of the level field and stamped it "USTA" regardless.
// Inventing a sanctioning body is precisely what made the owner distrust this
// data, so it is now read and never derived.
//
// The alternative keys are still consulted, because a record may name the field
// differently, but nothing is derived from prose. Every consumer of
// `federation` already handles its absence.
import type { Tournament, TournamentFederation } from "@/types";

const VALID: readonly TournamentFederation[] = ["ITF", "WTA", "ATP", "UTR", "USTA"];

function normalize(value: unknown): TournamentFederation | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toUpperCase();
  if ((VALID as readonly string[]).includes(v)) return v as TournamentFederation;
  if (v === "WTF") return "WTA"; // common typo upstream
  return undefined;
}

/**
 * The sanctioning body the record STATES, or undefined when it states none.
 *
 * Undefined is a real answer: the page shows no badge, rather than a badge for
 * a tour nobody said ran the event.
 */
export function readFederation(
  raw: Partial<Tournament> & Record<string, unknown>,
): TournamentFederation | undefined {
  return (
    normalize(raw.federation) ??
    normalize(raw.tour) ??
    normalize(raw.sanction) ??
    normalize(raw.circuit) ??
    normalize(raw.organization)
  );
}

export function mapTournament(raw: Record<string, unknown>): Tournament {
  const t = raw as Partial<Tournament> & Record<string, unknown>;
  return {
    id: String(t.id ?? raw.tournamentId ?? raw._id ?? crypto.randomUUID()),
    name: String(t.name ?? raw.title ?? "Untitled tournament"),
    city: String(t.city ?? raw.location ?? ""),
    country: String(t.country ?? ""),
    surface: String(t.surface ?? "Hard"),
    indoorOutdoor: (t.indoorOutdoor as Tournament["indoorOutdoor"]) ?? "outdoor",
    altitude: typeof t.altitude === "number" ? t.altitude : undefined,
    ballBrand: t.ballBrand as string | undefined,
    weatherSummary: t.weatherSummary as string | undefined,
    category: t.category as string | undefined,
    level: t.level as string | undefined,
    startDate: String(t.startDate ?? raw.start ?? raw.startsAt ?? ""),
    endDate: String(t.endDate ?? raw.end ?? raw.endsAt ?? t.startDate ?? ""),
    description: t.description as string | undefined,
    federation: readFederation(t),
    latitude: typeof t.latitude === "number" ? t.latitude : null,
    longitude: typeof t.longitude === "number" ? t.longitude : null,
    // Planning facts and provenance. The server has sent these for a while; this
    // mapper used to drop them on the floor, so in live mode every tournament
    // reached the page with no entry deadline and no source. Pass-through only —
    // a missing value stays missing rather than being guessed.
    entryDeadline: str(t.entryDeadline),
    ageCategory: str(t.ageCategory),
    venue: str(t.venue),
    website: str(t.website),
    registeredCount: num(t.registeredCount),
    utrRangeMin: num(t.utrRangeMin),
    utrRangeMax: num(t.utrRangeMax),
    source: str(t.source),
    lastSeenAt: str(t.lastSeenAt),
    updatedAt: str(t.updatedAt),
  };
}

/** A string field as sent, or undefined — never "" or "undefined" coerced from a null. */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function mapTournaments(payload: unknown): Tournament[] {
  // Accept either a bare array or a `{ data: [...] }` envelope.
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? ((payload as { data: unknown[] }).data)
      : [];
  return arr.map((r) => mapTournament(r as Record<string, unknown>));
}