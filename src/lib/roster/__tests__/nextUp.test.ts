// ============================================================================
// The roster countdowns.
//
// Three surfaces render these numbers — the player card, the team card and the
// stats drawer — so a wrong answer here is wrong in three places at once. The
// cases pinned below are the ones that actually bite: the late-evening
// "tomorrow", a session that was called off, an event that has already
// finished, two events on the same day, and a squad with nothing of its own
// booked.
//
// Every date is built with the LOCAL-time constructor. `"…Z"` strings would
// make the 23:00 → 09:00 case depend on the machine's timezone, which is
// exactly the bug the calendar-day arithmetic exists to prevent.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  calendarDaysUntil,
  nextTournamentFor,
  nextTournamentForTeam,
  nextTrainingFor,
  nextTrainingForTeam,
} from "../nextUp";
import type { PlayerTournament, Tournament, TrainingSession } from "@/types";

/** 10 Sep 2026, 12:00 local. */
const NOW = new Date(2026, 8, 10, 12, 0, 0);

function local(year: number, month: number, day: number, hour = 9, minute = 0): string {
  return new Date(year, month, day, hour, minute, 0).toISOString();
}

function tournament(over: Partial<Tournament> = {}): Tournament {
  return {
    id: "t-1",
    name: "J100 Vic",
    city: "Vic",
    country: "Spain",
    surface: "Clay",
    indoorOutdoor: "outdoor",
    startDate: local(2026, 8, 22),
    endDate: local(2026, 8, 26, 20),
    ...over,
  } as Tournament;
}

function entry(over: Partial<PlayerTournament> = {}, tour: Partial<Tournament> = {}): PlayerTournament {
  const t = tournament({ id: over.tournamentId ?? "t-1", ...tour });
  return {
    id: `pt-${t.id}`,
    tournamentId: t.id,
    tournament: t,
    playerId: "p1",
    status: "registered",
    ...over,
  } as PlayerTournament;
}

function session(over: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "s-1",
    title: "Serve patterns",
    trainingType: "individual",
    coachId: "c1",
    playerIds: ["p1"],
    status: "scheduled",
    startDate: local(2026, 8, 12, 17),
    endDate: local(2026, 8, 12, 18, 30),
    createdAt: local(2026, 8, 1),
    ...over,
  } as TrainingSession;
}

describe("calendarDaysUntil", () => {
  it("counts whole calendar days, not 24-hour blocks: 09:00 tomorrow is 1 day away at 23:00 tonight", () => {
    const lateTonight = new Date(2026, 8, 10, 23, 0);
    expect(calendarDaysUntil(local(2026, 8, 11, 9), lateTonight)).toBe(1);
  });

  it("calls something later the same day 0, however few hours are left", () => {
    const almostMidnight = new Date(2026, 8, 10, 23, 30);
    expect(calendarDaysUntil(local(2026, 8, 10, 23, 45), almostMidnight)).toBe(0);
    expect(calendarDaysUntil(local(2026, 8, 10, 7), NOW)).toBe(0);
  });

  it("counts across a month boundary and a whole fortnight", () => {
    expect(calendarDaysUntil(local(2026, 8, 22), NOW)).toBe(12);
    expect(calendarDaysUntil(local(2026, 9, 1), NOW)).toBe(21);
  });

  it("survives a daylight-saving change, where a day is 23 or 25 hours long", () => {
    // Europe/Madrid puts the clocks back on 25 Oct 2026; the gap either side of
    // it is not a whole number of 24-hour blocks.
    const beforeChange = new Date(2026, 9, 24, 12, 0);
    expect(calendarDaysUntil(local(2026, 9, 26, 12), beforeChange)).toBe(2);
  });

  it("clamps an event already under way to 0 rather than reporting a negative countdown", () => {
    expect(calendarDaysUntil(local(2026, 8, 9), NOW)).toBe(0);
    expect(calendarDaysUntil(local(2026, 7, 1), NOW)).toBe(0);
  });

  it("returns NaN for a date it cannot parse, so no caller renders a made-up day", () => {
    expect(calendarDaysUntil("not-a-date", NOW)).toBeNaN();
    expect(calendarDaysUntil(undefined as unknown as string, NOW)).toBeNaN();
  });
});

describe("nextTournamentFor", () => {
  it("returns the soonest entry with its city and its day count", () => {
    const next = nextTournamentFor(
      "p1",
      [
        entry({ tournamentId: "t-late" }, { startDate: local(2026, 9, 5), endDate: local(2026, 9, 9) }),
        entry({ tournamentId: "t-soon" }, { name: "Benidorm CH2", city: "Benidorm", startDate: local(2026, 8, 22), endDate: local(2026, 8, 26) }),
      ],
      NOW,
    );
    expect(next).toEqual({
      tournamentId: "t-soon",
      name: "Benidorm CH2",
      city: "Benidorm",
      startDate: local(2026, 8, 22),
      daysUntil: 12,
    });
  });

  it("ignores other players' entries", () => {
    const entries = [entry({ playerId: "p2", tournamentId: "t-other" })];
    expect(nextTournamentFor("p1", entries, NOW)).toBeNull();
  });

  it("skips a tournament that has already finished", () => {
    const entries = [entry({ tournamentId: "t-done" }, { startDate: local(2026, 7, 1), endDate: local(2026, 7, 6) })];
    expect(nextTournamentFor("p1", entries, NOW)).toBeNull();
  });

  it("still counts a tournament that is on right now — the player is at it — and calls it Today", () => {
    const entries = [entry({ tournamentId: "t-live" }, { startDate: local(2026, 8, 8), endDate: local(2026, 8, 14, 20) })];
    expect(nextTournamentFor("p1", entries, NOW)?.daysUntil).toBe(0);
  });

  it("skips a withdrawn entry", () => {
    const entries = [entry({ tournamentId: "t-out", status: "withdrawn" })];
    expect(nextTournamentFor("p1", entries, NOW)).toBeNull();
  });

  it("keeps planned and maybe entries — a coach still needs to see them", () => {
    expect(nextTournamentFor("p1", [entry({ tournamentId: "t-a", status: "planned" })], NOW)?.tournamentId).toBe("t-a");
    expect(nextTournamentFor("p1", [entry({ tournamentId: "t-b", status: "maybe" })], NOW)?.tournamentId).toBe("t-b");
  });

  it("breaks a same-day tie by id, whichever order the API returned them in", () => {
    const sameDay = { startDate: local(2026, 8, 20), endDate: local(2026, 8, 24) };
    const a = entry({ tournamentId: "t-aaa" }, sameDay);
    const b = entry({ tournamentId: "t-bbb" }, sameDay);
    expect(nextTournamentFor("p1", [a, b], NOW)?.tournamentId).toBe("t-aaa");
    expect(nextTournamentFor("p1", [b, a], NOW)?.tournamentId).toBe("t-aaa");
  });

  it("omits the city when the feed published none rather than printing an empty separator", () => {
    const entries = [entry({ tournamentId: "t-nocity" }, { city: "  " })];
    expect(nextTournamentFor("p1", entries, NOW)?.city).toBeUndefined();
  });

  it("skips an entry with no tournament attached, or an unparseable date", () => {
    const orphan = { id: "pt-x", tournamentId: "t-x", playerId: "p1", status: "registered" } as PlayerTournament;
    expect(nextTournamentFor("p1", [orphan], NOW)).toBeNull();
    const broken = [entry({ tournamentId: "t-broken" }, { startDate: "soon", endDate: "later" })];
    expect(nextTournamentFor("p1", broken, NOW)).toBeNull();
  });

  it("returns null for empty inputs and for no player", () => {
    expect(nextTournamentFor("p1", [], NOW)).toBeNull();
    expect(nextTournamentFor("", [entry()], NOW)).toBeNull();
    expect(nextTournamentFor("p1", undefined as unknown as PlayerTournament[], NOW)).toBeNull();
  });
});

describe("nextTrainingFor", () => {
  it("returns the soonest session the player is on", () => {
    const next = nextTrainingFor(
      "p1",
      [
        session({ id: "s-late", startDate: local(2026, 8, 18, 10), endDate: local(2026, 8, 18, 11) }),
        session({ id: "s-soon", title: "Return depth", startDate: local(2026, 8, 11, 17), endDate: local(2026, 8, 11, 18) }),
      ],
      NOW,
    );
    expect(next).toEqual({
      trainingId: "s-soon",
      title: "Return depth",
      startDate: local(2026, 8, 11, 17),
      daysUntil: 1,
    });
  });

  it("skips a cancelled session — the next session is one somebody will be on court for", () => {
    const next = nextTrainingFor(
      "p1",
      [
        session({ id: "s-off", status: "cancelled", startDate: local(2026, 8, 11, 9), endDate: local(2026, 8, 11, 10) }),
        session({ id: "s-on", startDate: local(2026, 8, 14, 9), endDate: local(2026, 8, 14, 10) }),
      ],
      NOW,
    );
    expect(next?.trainingId).toBe("s-on");
    expect(next?.daysUntil).toBe(4);
  });

  it("treats a session with no status field as scheduled (they predate cancelling)", () => {
    const legacy = session({ id: "s-legacy", status: undefined });
    expect(nextTrainingFor("p1", [legacy], NOW)?.trainingId).toBe("s-legacy");
  });

  it("skips a session that has already ended but keeps one still running", () => {
    const past = session({ id: "s-past", startDate: local(2026, 8, 3, 9), endDate: local(2026, 8, 3, 10) });
    expect(nextTrainingFor("p1", [past], NOW)).toBeNull();
    const running = session({ id: "s-now", startDate: local(2026, 8, 10, 11), endDate: local(2026, 8, 10, 13) });
    expect(nextTrainingFor("p1", [running], NOW)?.daysUntil).toBe(0);
  });

  it("ignores a session the player is not on", () => {
    expect(nextTrainingFor("p1", [session({ id: "s-others", playerIds: ["p2", "p3"] })], NOW)).toBeNull();
  });

  it("breaks a same-time tie by id, whichever order the API returned them in", () => {
    const when = { startDate: local(2026, 8, 13, 9), endDate: local(2026, 8, 13, 10) };
    const a = session({ id: "s-aaa", ...when });
    const b = session({ id: "s-bbb", ...when });
    expect(nextTrainingFor("p1", [a, b], NOW)?.trainingId).toBe("s-aaa");
    expect(nextTrainingFor("p1", [b, a], NOW)?.trainingId).toBe("s-aaa");
  });

  it("returns null for empty inputs and for no player", () => {
    expect(nextTrainingFor("p1", [], NOW)).toBeNull();
    expect(nextTrainingFor("", [session()], NOW)).toBeNull();
    expect(nextTrainingFor("p1", undefined as unknown as TrainingSession[], NOW)).toBeNull();
  });
});

describe("nextTournamentForTeam", () => {
  const squad = ["p1", "p2", "p3"];

  it("names the player whose tournament is soonest and counts how many have one coming up", () => {
    const entries = [
      entry({ tournamentId: "t-p1", playerId: "p1", playerName: "Alex Rivera" }, { startDate: local(2026, 8, 25), endDate: local(2026, 8, 29) }),
      entry({ tournamentId: "t-p2", playerId: "p2", playerName: "Sam Cole" }, { name: "J60 Burgas", city: "Burgas", startDate: local(2026, 8, 15), endDate: local(2026, 8, 19) }),
      entry({ tournamentId: "t-p2b", playerId: "p2", playerName: "Sam Cole" }, { startDate: local(2026, 9, 2), endDate: local(2026, 9, 6) }),
    ];
    const next = nextTournamentForTeam(squad, entries, NOW);
    expect(next).toEqual({
      tournamentId: "t-p2",
      name: "J60 Burgas",
      city: "Burgas",
      startDate: local(2026, 8, 15),
      daysUntil: 5,
      playerId: "p2",
      playerName: "Sam Cole",
      playersWithUpcoming: 2,
    });
  });

  it("counts players, not entries: three events for one player is one player with something coming up", () => {
    const three = [1, 2, 3].map((n) =>
      entry({ tournamentId: `t-${n}`, playerId: "p1" }, { startDate: local(2026, 8, 12 + n), endDate: local(2026, 8, 16 + n) }),
    );
    expect(nextTournamentForTeam(squad, three, NOW)?.playersWithUpcoming).toBe(1);
  });

  it("ignores entries belonging to players outside the squad", () => {
    const outsider = [entry({ tournamentId: "t-out", playerId: "p9" })];
    expect(nextTournamentForTeam(squad, outsider, NOW)).toBeNull();
  });

  it("breaks a same-day tie by id so the squad card never swaps between refreshes", () => {
    const sameDay = { startDate: local(2026, 8, 16), endDate: local(2026, 8, 20) };
    const a = entry({ tournamentId: "t-aaa", playerId: "p1" }, sameDay);
    const b = entry({ tournamentId: "t-bbb", playerId: "p2" }, sameDay);
    expect(nextTournamentForTeam(squad, [a, b], NOW)?.tournamentId).toBe("t-aaa");
    expect(nextTournamentForTeam(squad, [b, a], NOW)?.tournamentId).toBe("t-aaa");
  });

  it("returns null for an empty squad or an empty entry list", () => {
    expect(nextTournamentForTeam([], [entry()], NOW)).toBeNull();
    expect(nextTournamentForTeam(squad, [], NOW)).toBeNull();
    expect(nextTournamentForTeam(undefined as unknown as string[], [entry()], NOW)).toBeNull();
  });
});

describe("nextTrainingForTeam", () => {
  it("returns the squad's own next session", () => {
    const sessions = [
      session({ id: "s-team", title: "Squad session", teamId: "team-1", startDate: local(2026, 8, 12, 16), endDate: local(2026, 8, 12, 18) }),
      session({ id: "s-team-later", teamId: "team-1", startDate: local(2026, 8, 19, 16), endDate: local(2026, 8, 19, 18) }),
    ];
    expect(nextTrainingForTeam("team-1", ["p1"], sessions, NOW)).toEqual({
      trainingId: "s-team",
      title: "Squad session",
      startDate: local(2026, 8, 12, 16),
      daysUntil: 2,
    });
  });

  it("falls back to nothing, never to a squad member's individual session", () => {
    const individual = [session({ id: "s-solo", playerIds: ["p1"], startDate: local(2026, 8, 11, 9), endDate: local(2026, 8, 11, 10) })];
    expect(nextTrainingForTeam("team-1", ["p1"], individual, NOW)).toBeNull();
  });

  it("ignores another team's session", () => {
    const other = [session({ id: "s-other-team", teamId: "team-2" })];
    expect(nextTrainingForTeam("team-1", ["p1"], other, NOW)).toBeNull();
  });

  it("skips a cancelled squad session", () => {
    const off = [session({ id: "s-off", teamId: "team-1", status: "cancelled" })];
    expect(nextTrainingForTeam("team-1", ["p1"], off, NOW)).toBeNull();
  });

  it("returns null with no team id or no sessions", () => {
    expect(nextTrainingForTeam("", ["p1"], [session({ teamId: "team-1" })], NOW)).toBeNull();
    expect(nextTrainingForTeam("team-1", ["p1"], [], NOW)).toBeNull();
  });
});
