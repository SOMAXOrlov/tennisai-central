// ============================================================================
// TennisAI coaching library — controlled vocabularies.
//
// Skills and tactical patterns are CONTENT, not code: they live in
// `content/schema/skills.yaml` and `content/schema/patterns.yaml` so a
// researcher can extend them in a reviewable diff without touching TypeScript.
// They are loaded once, at import, and frozen — the zod schema below rejects
// any tag that is not in them.
//
// The path is resolved from `import.meta.url`, NOT from the working directory:
// this module is imported by the seed (run from `server/`), by vitest (run from
// `server/`) and by the content scripts (run from `server/` in CI), and a
// cwd-relative path would work in some of those and silently fail in others.
//
// WHY THERE IS ALSO AN ENV OVERRIDE
// That resolution assumes this file sits three levels below the repository
// root, which is true of a checkout and false of the production image: the API
// is built from `server/`, so in the container this module lives at
// `/app/src/library` and three levels up is `/`. The repo-root `content/`
// directory was never copied into that image, so the API died at import with a
// bare ENOENT for `/content/schema/skills.yaml` — in a restart loop, on boot,
// with the whole API down behind it. `CONTENT_DIR` lets the deployment say
// where the content actually is instead of inferring it from a layout that
// only holds in one of the two places this code runs.
//
// The failure is now checked here rather than left to `readFileSync`, because
// a missing content directory is a deployment fault and deserves a sentence
// that says so — not a stack trace inside a YAML parser.
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));

/** Repository root — `server/src/library` → three levels up. */
export const REPO_ROOT = resolve(here, "..", "..", "..");

/**
 * Where the coaching content lives.
 *
 * `CONTENT_DIR` in the environment wins; otherwise the repository layout is
 * assumed, which is correct for the seed, the tests and the content scripts.
 */
export const CONTENT_DIR = process.env.CONTENT_DIR
  ? resolve(process.env.CONTENT_DIR)
  : resolve(REPO_ROOT, "content");
export const DRILLS_DIR = resolve(CONTENT_DIR, "drills");
export const SCHEMA_DIR = resolve(CONTENT_DIR, "schema");

if (!existsSync(SCHEMA_DIR)) {
  const source = process.env.CONTENT_DIR ? "the CONTENT_DIR environment variable" : "the repository layout";
  throw new Error(
    `Coaching content not found at ${SCHEMA_DIR} (resolved from ${source}). ` +
      `The API cannot start without it. In a container, mount the repository's ` +
      `content/ directory and set CONTENT_DIR to where it is mounted.`,
  );
}

function readYaml(file: string): unknown {
  return parseYaml(readFileSync(resolve(SCHEMA_DIR, file), "utf8"));
}

/** Flatten `{ domain: [tag, ...] }` into one sorted, de-duplicated list. */
function flattenGroups(doc: unknown, file: string): string[] {
  if (!doc || typeof doc !== "object") throw new Error(`${file}: expected a mapping of groups to tag lists`);
  const out = new Set<string>();
  for (const [group, tags] of Object.entries(doc as Record<string, unknown>)) {
    if (!Array.isArray(tags)) throw new Error(`${file}: group "${group}" is not a list`);
    for (const tag of tags) {
      if (typeof tag !== "string") throw new Error(`${file}: group "${group}" holds a non-string tag`);
      out.add(tag);
    }
  }
  return [...out].sort();
}

export const SKILLS: readonly string[] = Object.freeze(flattenGroups(readYaml("skills.yaml"), "skills.yaml"));
export const PATTERNS: readonly string[] = Object.freeze(flattenGroups(readYaml("patterns.yaml"), "patterns.yaml"));

export const SKILL_SET: ReadonlySet<string> = new Set(SKILLS);
export const PATTERN_SET: ReadonlySet<string> = new Set(PATTERNS);
