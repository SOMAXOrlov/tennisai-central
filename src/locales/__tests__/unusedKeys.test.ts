// ============================================================================
// The other half of the i18n ratchet.
//
// `hardcodedText.test.ts` stops English leaking into the UI. This one stops the
// bundles growing keys nothing renders — copy that is translated, reviewed and
// carried forever without ever reaching a reader.
//
// A key counts as used when its full dot-path appears anywhere in `src/`, OR
// when it sits under a prefix the code builds dynamically, e.g.
// `t(`common.status.${status}`)`. Those prefixes are discovered from the source
// rather than listed here, so adding one is not a chore.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";

const ROOT = path.resolve(__dirname, "../../..");

type MessageNode = string | { [key: string]: MessageNode };

function flatten(node: MessageNode, prefix = "", out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(prefix);
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    flatten(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/** Every .ts/.tsx file under src, except the bundles themselves. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "locales") continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(full)) {
      out.push(full);
    }
  }
  return out;
}

describe("locale bundles carry no dead copy", () => {
  const corpus = sourceFiles(path.join(ROOT, "src"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  /** Prefixes the code completes at runtime: t(`a.b.${x}`) and t("a.b." + x). */
  const dynamicPrefixes = new Set<string>();
  for (const match of corpus.matchAll(/`([A-Za-z0-9_.]+)\.\$\{/g)) dynamicPrefixes.add(match[1]);
  for (const match of corpus.matchAll(/"([A-Za-z0-9_.]+)\."\s*\+/g)) dynamicPrefixes.add(match[1]);

  it("finds the source it is meant to be reading", () => {
    // Guards against a path change turning this into a test that passes because
    // it read nothing.
    expect(corpus.length).toBeGreaterThan(100_000);
    expect(dynamicPrefixes.size).toBeGreaterThan(0);
  });

  it("every key in en.json is rendered somewhere", () => {
    const unused = flatten(en as MessageNode).filter((key) => {
      if (corpus.includes(key)) return false;
      for (const prefix of dynamicPrefixes) if (key.startsWith(`${prefix}.`)) return false;
      return true;
    });
    expect(unused).toEqual([]);
  });
});
