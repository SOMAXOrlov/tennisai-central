// ============================================================================
// Quick actions — who gets which action, and that the tiny phone forms produce
// EXACTLY the payloads the existing endpoints already accept. These builders
// are what leaves the phone; if they drift from POST /trainings and
// POST /matches the courtside sheet 400s while the desktop form still works.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  buildMatchPayload,
  buildTrainingPayload,
  quickActionsFor,
  targetKey,
  toDateInput,
  toDateTimeLocal,
} from "@/components/mobile/quickActionsModel";

describe("quickActionsFor", () => {
  it("gives a coach the training log and a player the score entry", () => {
    expect(quickActionsFor("coach")).toEqual(["log-training"]);
    expect(quickActionsFor("player")).toEqual(["match-score"]);
  });

  it("gives admins and observers nothing — no trigger opens onto a dead end", () => {
    // Observer: the API scopes trainings to coach/participant and attendance
    // writes to the coach, so there is no action a parent can complete.
    expect(quickActionsFor("observer")).toEqual([]);
    expect(quickActionsFor("admin")).toEqual([]);
  });

  it("never lists more than three actions for any role", () => {
    for (const role of ["player", "coach", "observer", "admin"] as const) {
      expect(quickActionsFor(role).length).toBeLessThanOrEqual(3);
    }
  });
});

describe("buildTrainingPayload", () => {
  const start = "2026-09-05T17:30";

  it("logs an individual session for one player; start + duration → endDate", () => {
    const payload = buildTrainingPayload({
      coachId: "c1",
      title: "Training with Alice Adams",
      target: { kind: "player", id: "p1", name: "Alice Adams" },
      start,
      durationMinutes: 90,
      note: "  second serve  ",
    });
    expect(payload.trainingType).toBe("individual");
    expect(payload.playerIds).toEqual(["p1"]);
    expect(payload).not.toHaveProperty("teamId");
    expect(payload.coachId).toBe("c1");
    expect(payload.title).toBe("Training with Alice Adams");
    // The note is private to the coach: coachNotes, never player-visible notes.
    expect(payload.coachNotes).toBe("second serve");
    expect(payload).not.toHaveProperty("notes");
    // 90 minutes after the local start the coach picked.
    expect(new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()).toBe(90 * 60_000);
    expect(payload.startDate).toBe(new Date(start).toISOString());
  });

  it("logs a team session with the team's players and teamId, and omits an empty note", () => {
    const payload = buildTrainingPayload({
      coachId: "c1",
      title: "Team training: U14",
      target: { kind: "team", id: "t1", name: "U14", playerIds: ["p1", "p2"] },
      start,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      note: "   ",
    });
    expect(payload.trainingType).toBe("team");
    expect(payload.teamId).toBe("t1");
    expect(payload.playerIds).toEqual(["p1", "p2"]);
    expect(payload).not.toHaveProperty("coachNotes");
  });

  it("offers an ascending duration ladder with the default on it", () => {
    expect(DURATION_OPTIONS).toContain(DEFAULT_DURATION_MINUTES);
    expect([...DURATION_OPTIONS]).toEqual([...DURATION_OPTIONS].sort((a, b) => a - b));
  });

  it("namespaces player and team keys so one Select can list both", () => {
    expect(targetKey({ kind: "player", id: "x", name: "X" })).not.toBe(
      targetKey({ kind: "team", id: "x", name: "X", playerIds: [] }),
    );
  });
});

describe("buildMatchPayload", () => {
  it("sends what the player typed, plus the API's required defaults for the rest", () => {
    const payload = buildMatchPayload({
      opponentId: "opp-1",
      date: "2026-09-05",
      surface: "clay",
      scoreSets: [
        { player: 6, opponent: 4 },
        { player: 7, opponent: 6, tiebreak: "7-3" },
      ],
      result: "win",
    });
    expect(payload).toEqual({
      opponentId: "opp-1",
      date: "2026-09-05",
      surface: "clay",
      indoorOutdoor: "outdoor",
      format: "best_of_3",
      result: "win",
      scoreSets: [
        { player: 6, opponent: 4 },
        { player: 7, opponent: 6, tiebreak: "7-3" },
      ],
    });
  });

  it("omits opponent and result when not recorded rather than sending null or a guess", () => {
    const payload = buildMatchPayload({
      opponentId: null,
      date: "2026-09-05",
      surface: "hard",
      scoreSets: [{ player: 6, opponent: 4 }],
      result: null,
    });
    expect(payload).not.toHaveProperty("opponentId");
    expect(payload).not.toHaveProperty("result");
  });

  it("never fabricates a statistic — no count keys leave the phone", () => {
    const payload = buildMatchPayload({
      opponentId: null,
      date: "2026-09-05",
      surface: "grass",
      scoreSets: [{ player: 6, opponent: 4 }],
      result: "loss",
    });
    for (const key of ["aces", "doubleFaults", "firstServesIn", "firstServeAttempts", "winners", "unforcedErrors"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });
});

describe("date helpers", () => {
  it("format in LOCAL time for the browser's date controls", () => {
    const d = new Date(2026, 8, 5, 17, 5); // 5 Sep 2026 17:05 local
    expect(toDateTimeLocal(d)).toBe("2026-09-05T17:05");
    expect(toDateInput(d)).toBe("2026-09-05");
  });
});
