// Where the coaching library looks for its content, and what it does when the
// content is not there.
//
// This exists because of a real outage. The production image is built from
// `server/`, so the repository's content/ directory is not in it, and the
// module's fallback — three levels above src/library — is the repository root
// in a checkout but `/` in the container. The API threw ENOENT for
// /content/schema/skills.yaml at import, restart-looped, and every request
// behind it failed while the site itself carried on serving.
//
// Two things are asserted: the environment can say where the content is, and a
// missing directory fails with a sentence that names the fault instead of a
// stack trace from inside a YAML parser.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ORIGINAL = process.env.CONTENT_DIR;

beforeEach(() => {
  delete process.env.CONTENT_DIR;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CONTENT_DIR;
  else process.env.CONTENT_DIR = ORIGINAL;
});

/**
 * Import a fresh copy of the module, so its import-time check runs again.
 *
 * `vi.resetModules()` rather than a cache-busting query string: the query
 * string is read as a loader argument and the import fails for the wrong
 * reason, which is a test that passes or fails on something unrelated to what
 * it claims to check.
 */
async function loadVocab(): Promise<typeof import("../vocab")> {
  vi.resetModules();
  return import("../vocab");
}

describe("where the coaching content is found", () => {
  it("falls back to the repository layout when nothing is configured", async () => {
    const vocab = await loadVocab();
    expect(vocab.CONTENT_DIR).toBe(resolve(vocab.REPO_ROOT, "content"));
    // The fallback has to actually work in a checkout, which is the case this
    // covers: the seed, the tests and the content scripts all rely on it.
    expect(existsSync(vocab.SCHEMA_DIR)).toBe(true);
  });

  it("lets the environment say where the content is", async () => {
    // The container case. The path is real content, reached by an absolute
    // path rather than by counting directories up from this file.
    const { REPO_ROOT } = await loadVocab();
    process.env.CONTENT_DIR = resolve(REPO_ROOT, "content");

    const vocab = await loadVocab();
    expect(vocab.CONTENT_DIR).toBe(resolve(REPO_ROOT, "content"));
    // Not just the path: the YAML behind it was actually read and parsed.
    expect(vocab.SKILLS.length).toBeGreaterThan(0);
    expect(vocab.PATTERNS.length).toBeGreaterThan(0);
  });

  it("refuses to load with a message that names the fault, not an ENOENT", async () => {
    process.env.CONTENT_DIR = resolve(process.cwd(), "no-such-content-directory");

    // The bug in production was a bare `ENOENT ... open '/content/schema/
    // skills.yaml'` from readFileSync. What a reader needs is which directory
    // was tried and where that path came from.
    await expect(loadVocab()).rejects.toThrow(/Coaching content not found/i);
    await expect(loadVocab()).rejects.toThrow(/CONTENT_DIR environment variable/i);
  });
});
