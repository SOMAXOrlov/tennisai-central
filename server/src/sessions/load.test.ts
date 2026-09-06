import { describe, expect, it } from "vitest";
import { focusTagsFromText, libraryAgeBand, libraryLevel, toLibraryDrill, type DrillRow } from "./load";

describe("session loaders — the pure parts", () => {
  it("maps ages to the library's bands, including u10", () => {
    expect(libraryAgeBand(8)).toBe("u10");
    expect(libraryAgeBand(11)).toBe("u12");
    expect(libraryAgeBand(13)).toBe("u14");
    expect(libraryAgeBand(15)).toBe("u16");
    expect(libraryAgeBand(18)).toBe("u18");
    expect(libraryAgeBand(19)).toBe("adult");
  });

  it("maps the profile's loose level to a library band, competitive → high_performance, unknown → undefined", () => {
    expect(libraryLevel("Beginner")).toBe("beginner");
    expect(libraryLevel("club player")).toBe("intermediate");
    expect(libraryLevel("Advanced")).toBe("advanced");
    expect(libraryLevel("Competitive / tournament")).toBe("high_performance");
    expect(libraryLevel("something else")).toBeUndefined();
    expect(libraryLevel(null)).toBeUndefined();
  });

  it("turns post-match priorities into skill tags conservatively, dropping what it does not recognise", () => {
    expect(focusTagsFromText(["Second-serve consistency under pressure"])).toEqual(
      ["emotional_control", "score_management", "second_serve_kick", "serve_placement", "shot_tolerance"].sort(),
    );
    expect(focusTagsFromText(["Deeper cross-court forehands"])).toEqual(["depth_control", "direction_change", "forehand_drive", "forehand_topspin"]);
    expect(focusTagsFromText(["Bring more snacks"])).toEqual([]);
    expect(focusTagsFromText([])).toEqual([]);
  });

  it("folds tags and sources into a flat LibraryDrill, sorted so the assembler is order-independent", () => {
    const row = {
      id: "x",
      status: "approved",
      visibility: "global",
      ownerCoachId: null,
      academyId: null,
      titleEn: "X",
      domain: "tactics",
      blockKinds: ["tactical"],
      levelBands: ["intermediate"],
      ageBands: ["u14", "adult"],
      playersMin: 2,
      playersMax: 4,
      courtsMin: 1,
      courtsMax: 1,
      equipment: ["balls"],
      defaults: { durationMin: 12, reps: 20, sets: 2, restSec: 60, intensity: "high" },
      ranges: { durationMin: [8, 20], reps: [10, 40], sets: [1, 4] },
      requiresQualifiedSupervision: false,
      objectiveEn: "o",
      setupEn: "s",
      stepsEn: ["a"],
      cuesEn: ["c"],
      successCriteriaEn: "sc",
      tags: [
        { kind: "skill", tag: "shot_tolerance" },
        { kind: "pattern", tag: "cross_court_rally_battle" },
        { kind: "skill", tag: "depth_control" },
      ],
      sources: [{ coachOrBody: "Zed" }, { coachOrBody: "TennisAI coaching library" }, { coachOrBody: "Zed" }],
    } as unknown as DrillRow;

    const d = toLibraryDrill(row);
    expect(d.skills).toEqual(["depth_control", "shot_tolerance"]);
    expect(d.patterns).toEqual(["cross_court_rally_battle"]);
    expect(d.sourceBodies).toEqual(["TennisAI coaching library", "Zed"]);
    expect(d.ownerCoachId).toBeUndefined();
    expect(d.defaults.intensity).toBe("high");
    expect(d.ranges.durationMin).toEqual([8, 20]);
  });
});
