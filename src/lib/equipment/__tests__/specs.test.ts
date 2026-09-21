import { describe, expect, it } from "vitest";
import { formToSpecs, specChips, specsToForm } from "../specs";

const t = (key: string, vars?: Record<string, string | number>) =>
  vars && "value" in vars ? `${key.split(".").pop()}=${vars.value}` : key;
const num = (n: number) => String(n);

describe("formToSpecs", () => {
  it("types numbers, keeps text, drops empties and junk, and is null when nothing is set", () => {
    expect(formToSpecs("string", { gaugeMm: "1,25", setLengthM: "12" })).toEqual({ gaugeMm: 1.25, setLengthM: 12 });
    expect(formToSpecs("racket", { gripSize: " L3 ", weightG: "abc", stringPattern: "" })).toEqual({ gripSize: "L3" });
    expect(formToSpecs("shoes", { size: "", surface: "" })).toBeNull();
    // Only the category's own fields are read: a gauge typed for a racket never leaves the form.
    expect(formToSpecs("racket", { gaugeMm: "1.25" })).toBeNull();
  });
});

describe("specsToForm", () => {
  it("round-trips through the form as text", () => {
    expect(specsToForm({ gaugeMm: 1.25, setLengthM: 12 })).toEqual({ gaugeMm: "1.25", setLengthM: "12" });
    expect(specsToForm(undefined)).toEqual({});
  });
});

describe("specChips", () => {
  it("builds one chip per set field, in the category's order, translating the surface", () => {
    expect(specChips("shoes", { surface: "clay", size: "EU 42.5" }, t, num)).toEqual(["size=EU 42.5", "surface=equipment.surface.clay"]);
    expect(specChips("string", { gaugeMm: 1.25 }, t, num)).toEqual(["gaugeMm=1.25"]);
    expect(specChips("racket", undefined, t, num)).toEqual([]);
  });
});
