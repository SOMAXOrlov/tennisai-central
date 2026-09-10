import { describe, it, expect } from "vitest";
import {
  formatSetupTension,
  formatTensionKg,
  kgToLbs,
  lbsToKg,
  parseTensionKg,
  TENSION_MAX_KG,
  TENSION_MIN_KG,
} from "@/lib/equipment/tension";

describe("kg ↔ lb", () => {
  it("converts with the server's factor and whole pounds", () => {
    expect(kgToLbs(23)).toBe(51);
    expect(kgToLbs(25)).toBe(55);
    expect(kgToLbs(22.5)).toBe(50);
  });
  it("round-trips a pounds value to one decimal of kg", () => {
    expect(lbsToKg(52)).toBe(23.6);
    expect(lbsToKg(55)).toBe(24.9);
  });
});

describe("parseTensionKg", () => {
  it("accepts a plain number, a decimal point and a decimal comma", () => {
    expect(parseTensionKg("23")).toBe(23);
    expect(parseTensionKg(" 23.5 ")).toBe(23.5);
    expect(parseTensionKg("23,5")).toBe(23.5);
  });
  it("refuses blanks, words, and — the real trap — a pounds value typed as kilograms", () => {
    expect(parseTensionKg("")).toBeNull();
    expect(parseTensionKg("tight")).toBeNull();
    expect(parseTensionKg("52")).toBeNull();
    expect(parseTensionKg(String(TENSION_MIN_KG - 0.1))).toBeNull();
    expect(parseTensionKg(String(TENSION_MAX_KG + 0.1))).toBeNull();
  });
  it("keeps the bounds the API enforces", () => {
    expect(parseTensionKg(String(TENSION_MIN_KG))).toBe(TENSION_MIN_KG);
    expect(parseTensionKg(String(TENSION_MAX_KG))).toBe(TENSION_MAX_KG);
  });
});

describe("formatting", () => {
  it("shows one figure for a single-tension job", () => {
    expect(formatTensionKg(23)).toBe("23 kg · 51 lb");
    expect(formatSetupTension(23, null)).toBe("23 kg · 51 lb");
    expect(formatSetupTension(23, 23)).toBe("23 kg · 51 lb");
  });
  it("shows mains / crosses when they differ", () => {
    expect(formatSetupTension(24, 22)).toBe("24 / 22 kg · 53 / 49 lb");
  });
  it("lets the caller format the digits for the locale", () => {
    const es = (n: number) => String(n).replace(".", ",");
    expect(formatSetupTension(23.5, null, es)).toBe("23,5 kg · 52 lb");
  });
});
