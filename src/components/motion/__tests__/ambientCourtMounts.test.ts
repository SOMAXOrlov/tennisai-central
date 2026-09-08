// Where the moving background is allowed to be.
//
// The owner asked for the ambient court to be taken off every screen except
// the landing page. That is a fact about the whole source tree rather than
// about any one component, so this test reads the tree instead of rendering
// anything: it finds every JSX mount of <AmbientCourt> and insists the set is
// exactly one file.
//
// Mounting it again in a layout is the specific regression being guarded
// against — it is a two-line change, it looks harmless in review, and it would
// silently put movement back behind every page a coach works on. Nothing else
// in the repository would have complained.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

/** src/components/motion/__tests__ -> src */
const SRC = resolve(__dirname, "..", "..", "..");

/** The only file allowed to render the layer, POSIX-separated. */
const ALLOWED_MOUNTS = ["pages/Index.tsx"];

/** Every .tsx under src/, except the tests themselves. */
function componentFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      componentFiles(full, found);
    } else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * `<AmbientCourt` followed by a boundary, so a hypothetical
 * <AmbientCourtSomethingElse> is not silently counted as this one.
 *
 * A regex LITERAL on purpose. Built with RegExp() from a template literal,
 * `\s` is not a recognised escape there and collapses to a bare "s" - the
 * pattern then demands the letter s after the tag name, matches nothing, and
 * this file passes by finding zero mounts. That is the one failure mode that
 * would make the whole test worthless, and it is what the first draft did.
 */
const MOUNT = /<AmbientCourt(?=[\s/>])/;

/** Files whose JSX renders the element - not files that merely name it. */
function filesMounting(mount: RegExp): string[] {
  return componentFiles(SRC)
    .filter((file) => mount.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC, file).split(sep).join("/"))
    .sort();
}

describe("the ambient court is mounted on the landing page and nowhere else", () => {
  it("has exactly one mount, and it is the landing page", () => {
    // Equality, not `toContain`: the point of the test is what is ABSENT.
    expect(filesMounting(MOUNT)).toEqual(ALLOWED_MOUNTS);
  });

  it("is not imported by any layout", () => {
    const layouts = componentFiles(resolve(SRC, "layouts"));
    expect(layouts.length).toBeGreaterThan(0); // the walk found something to check
    for (const layout of layouts) {
      expect(readFileSync(layout, "utf8")).not.toMatch(/^\s*import .*AmbientCourt/m);
    }
  });

  it("proves the search would find a mount if one existed", () => {
    // A regex typo would make both assertions above pass on an empty result.
    // The landing page is the positive control.
    expect(filesMounting(MOUNT).length).toBe(1);
    expect(readFileSync(resolve(SRC, "pages", "Index.tsx"), "utf8")).toContain("<AmbientCourt");
  });
});
