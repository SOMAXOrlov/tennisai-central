# The session assembler (v1)

How a `SessionTemplate`, a set of constraints, the players on court and the
coach's preferences become a proposed session built **only** from the coaching
library — and how the coach's edits are recorded.

v1 is **deterministic**. It is a pure function with a seed. No language model is
involved anywhere in this path, and the assembler can never invent a drill: every
drill it places is a `Drill` row the coach may see.

> Library, schema and provenance: [`docs/library.md`](./library.md).

---

## Where the code lives

| File | What it is |
|---|---|
| `server/src/sessions/types.ts` | the input/output contract; no logic |
| `server/src/sessions/prng.ts` | mulberry32 + a seeded shuffle (never `Math.random`) |
| `server/src/sessions/scoring.ts` | hard eligibility, the soft weights, the surface map |
| `server/src/sessions/assemble.ts` | `assembleSession()` — the algorithm and the rendering |
| `server/src/sessions/diff.ts` | `diffSessions()` — proposal vs. what the coach saved |
| `server/src/sessions/final.ts` | validate + hydrate the coach's edit, map it to plan drills |
| `server/src/sessions/load.ts` | the only file here that touches Prisma |
| `server/src/sessions/routes.ts` | authorization, persistence, HTTP |
| `server/src/library/visibility.ts` | the one visibility predicate, shared with the plan routes |

`assemble.ts`, `scoring.ts`, `diff.ts`, `final.ts` and `prng.ts` are pure: no
Prisma, no clock, no randomness. That is what makes every rule testable from a
fixture and every proposal reproducible from its stored inputs.

---

## The algorithm, step by step

### 1. Refuse early, in plain words

Before anything is scored the assembler answers "can this work at all?" and, if
not, returns `{ ok: false, code, reason }` rather than a session that pretends:

| `code` | When |
|---|---|
| `empty_library` | the visible library has no drills |
| `no_common_age_band` | no drill is written for every age band present (or, with an unknown age, for juniors *and* adults) |
| `courts_too_few` | fewer courts than the least demanding drill needs |
| `no_drill_fits` | every template block came out empty after the hard filters |
| `time_budget_unfit` | the eligible drills' duration ranges cannot reach the target within ±5 % |

The route turns these into **422** with the reason text.

### 2. The intensity ceiling

The coach's `intensityCap` (1–5) is the starting point and it only ever goes
down:

- a **physical concern on record** for any player → capped at `WELLBEING_CAP = 3`
  (medium) and one caution (see *Safeguarding* below);
- **≥ `HIGH_LOAD_MINUTES_7D` (300)** training minutes in the last 7 days → −1,
  per player, with a reason citing the minutes;
- a **"felt tired"** wellbeing flag on a recent session → −1, per player.

Every step writes an `intensity_capped` reason onto every slot whose drill had to
be clamped, so the coach sees the cause on the drill it affected.

### 3. Template-level preferences

Two `CoachPreference` kinds act on the template rather than on drills:

- `block_order` — `key` is a comma-separated permutation of the template's block
  kinds. Applied only if it is a true permutation (nothing is dropped by a typo).
- `duration` — `key` is a block kind; the block's `sharePct` is multiplied by the
  row's `weight`.

Both record their row id in `preferencesApplied`.

### 4. Candidate pools and the hard filters

For each template block, every library drill is put through `eligibility()`
(`scoring.ts`). The order is the order a coach would ask the questions in, and
the **first failure is the answer**:

| Check | Code | Rule |
|---|---|---|
| block kind | `block_kind` | the drill declares this block kind |
| **age band** | `age_band` | the drill is written for **every** band present — for a group that is the intersection of the players' bands |
| unknown age | `age_band` | with any unknown date of birth, only drills written for **both** a junior band (u14/u16/u18) **and** adult are placed |
| level | `level_band` | the drill covers at least one known level in the group (skipped when no level is known) |
| players | `players` | players-per-court (`ceil(players / courts)`) is inside the drill's `players` range |
| courts | `courts` | `courts >= drill.courts.min` |
| equipment | `equipment` | every item the drill needs is on the coach's list (skipped entirely when the list is empty — confidence drops instead) |
| u14 strength | `bodyweight_only` | strength work for a possible under-14 must use no external load (barbell / dumbbell / kettlebell / med ball / weight / plate / sandbag / band) |
| u14 strength | `supervision_required` | …and must carry `requiresQualifiedSupervision` |

Nothing soft can rescue a drill that fails one of these. The three safeguarding
refusals (`age_band`, `bodyweight_only`, `supervision_required`) are surfaced in
`proposal.excluded[]` so a coach can see *why* a drill they expected is missing.

A block with an empty pool is **dropped**, listed in `droppedBlocks`, and its
minutes are shared out over the surviving blocks — a missing cool-down drill does
not fail the session.

### 5. Minutes per block

`splitMinutes()` gives each block `totalMinutes × sharePct / Σ sharePct`, clamped
to the block's `minMin`/`maxMin`, then walks the rounding drift one minute at a
time onto whichever block has the most headroom.

### 6. Choosing drills

Within a block, every candidate is scored (below), then sorted by

1. score, descending;
2. a **seeded shuffle** of the candidate ids (mulberry32 over an FNV-1a hash of
   the seed string);
3. drill id.

So equal scores are broken reproducibly: the same seed always yields the same
session, a different seed yields a different one, and the library's row order
never matters (the library is sorted by id on entry).

The block takes `clamp(round(targetMinutes / 12), 1, 3)` drills. A drill is never
placed twice in one session.

**Alternatives.** Each slot gets exactly two, in two tiers:

- `primary` — candidates sharing one of the chosen drill's skills that the coach
  actually asked for (`constraints.focusGoals`);
- `related` — when the goal skill is rare in that block, candidates sharing any
  of the chosen drill's skills.

Every alternative names its `sharedSkills`; one is never offered without a shared
skill, however short the library. A slot with fewer than two alternatives lowers
the proposal's confidence and says so.

### 7. Fitting the time

1. every slot starts at its drill's default duration, clamped to the drill's
   `ranges.durationMin`;
2. each block is scaled to its target inside those ranges;
3. **one** session-wide adjustment pass moves the total towards
   `constraints.totalMinutes`, always taking from (or giving to) the slot with
   the most slack, so the change is spread rather than dumped on one drill.

If the result is still outside ±5 % the answer is `ok: false, code:
"time_budget_unfit"` — never a session whose stated length is a lie.

### 8. Rendering

The proposal is emitted as a superset of the client `GeneratedSession` (below).

---

## Hard vs. soft, at a glance

**Hard** (a drill either passes or is not placed): block kind, age band, level
band, players per court, courts, equipment, the under-14 strength rules, and the
±5 % time budget for the session as a whole.

**Soft** (they move a score and write a reason): the coach's focus goals, each
player's post-match priorities, level coverage, surface affinity, intensity
versus the applied cap, group logistics, domain/block fit, kids' games, and the
`CoachPreference` rows.

## Scoring weights

`WEIGHTS` in `server/src/sessions/scoring.ts` is the **whole** model — there is no
hidden term. If a drill scores higher, one of these lines is why.

| Weight | Value | Rationale |
|---|---:|---|
| `focusGoal` | **+3** per shared skill | what the coach explicitly asked for dominates everything else |
| `playerFocus` | +1.5 per shared skill | the player's last match matters, but the coach's plan for today outranks it |
| `levelAll` / `levelSome` | +2 / +1 | a drill everyone can do beats one that only half the group can |
| `surface` | +1.5 per hit, capped at +3 (`surfaceMax`) | surface relevance is a real edge before an event, but two hits is as much signal as it carries |
| `otherSurface` | −1 | a grass-signature pattern before a clay event is not wrong, just not the priority — a nudge, never an exclusion |
| `overCap` | −2 | a drill above the ceiling is still usable clamped, but a drill already at the right intensity is better |
| `wholeGroup` | +1 | no rotation needed means more balls hit per minute |
| `domainFit` | +1 | a tactics drill sits more naturally in the tactical block (soft: `BLOCK_DOMAINS`) |
| `kidsGame` | +1 | for a group of u12s and younger, game-based work holds attention |
| `favourSource` / `avoidSource` | +2 / −3 × row weight | avoiding is a stronger signal than favouring: a coach who removes a source three times means it |
| `favourDrill` / `avoidDrill` | +3 / −5 × row weight | naming one drill is the most specific statement a coach can make |
| `intensityPref` | +1 × row weight | a mild tilt towards the intensity this coach tends to run |

Surface knowledge lives in one place, `SURFACE_AFFINITY` — drills carry no surface
field. It is deliberately soft.

## Reason codes

Every reason is `{ code, params, textEn }`. `code` and `params` are stable and
machine-readable; `textEn` is English-only in v1 (Spanish comes with the editor
UI). A reason never cites a number the assembler did not have — where an input is
missing the term is skipped and confidence drops instead of guessing.

| `code` | Params | Says |
|---|---|---|
| `block_fit` | `kind` | fills this block of the template |
| `focus_goal_match` | `skills` | trains a skill the coach asked for |
| `player_focus_match` | `playerId`, `player`, `skills` | matches a named player's post-match priority |
| `level_fit` | `levels`, `all` | written for everyone / part of the group |
| `age_band_ok` | `bands` | the age check was made and passed |
| `surface_affinity` | `surface`, `skills`, `tournament?`, `daysUntil?` | relevant to the surface, and which tournament put it there |
| `group_size_ok` | `players`, `courts`, `perCourt?` | takes the whole group, or runs N per court |
| `kids_game` | `domain` | a game-based drill for under-12s |
| `coach_preference` | `kind`, `key` | a `CoachPreference` row raised this drill |
| `intensity_capped` | `cause` (`coach_cap` / `recent_load` / `felt_tired` / `wellbeing`), `from`, `to`, … | the drill runs below its default intensity, and why |
| `coach_edit` | `drillId` | (in `final` only) the coach added this drill when saving |

Cautions are separate from reasons: `seek_qualified_assessment` and
`age_band_unknown`.

## Safeguarding

- **Age is a hard filter.** Never a drill outside the band — for a group, the
  intersection of every player's band. An adult-only drill cannot appear for an
  under-12 even when it is the single best focus match.
- **Unknown age is treated as a minor.** No date of birth on the profile means
  the band cannot be checked, so only drills written for both juniors and adults
  are placed, the under-14 rules are applied anyway, an `age_band_unknown`
  caution is emitted, and confidence drops to `low`.
- **Under-14 strength work** is bodyweight only *and* must carry the
  `requiresQualifiedSupervision` flag. Anything else is excluded with its reason.
- **No medical language, ever.** Injury text and wellbeing reports become a single
  boolean (`painOrInjury`) in `load.ts`; the assembler never sees the text, so no
  proposal can quote or paraphrase it. When that boolean is true the proposal
  carries **exactly one** caution — recommending assessment by a qualified
  professional — and a lower intensity cap whose reason does **not** state a
  cause. Nothing else in the session refers to it. A spec asserts that no
  proposal, on any fixture, contains medical vocabulary.

## Confidence

`{ level, raisedBy }` for the whole proposal. `raisedBy` is the single next thing
that would improve it. Inputs that lower it: a player with no date of birth
(always `low`), a player with no level, no focus goal, no equipment list, a slot
with fewer than two alternatives, no players named. Two or more of those → `low`,
one → `medium`, none → `high`.

---

## The proposal JSON, and the client mapping

`SessionProposal` is a **superset** of the client `GeneratedSession`
(`src/lib/session/types.ts`): every field the Session Builder renders today is
present with the same name and meaning, so Wave 1 can render a proposal with
today's components and progressively surface the extra detail.

| Client `GeneratedSession` | Proposal | Note |
|---|---|---|
| `title`, `summary` | same | generated from goal + focus areas + level |
| `level` | same | `beginner` / `intermediate` / `advanced` (high-performance folds into advanced) |
| `goal` | same | `recovery` when the cap ≤ 2, `match_prep` within 14 days of a tournament, else the dominant drill category |
| `intensity` | same | `low` / `medium` / `high`, derived from the applied 1–5 cap |
| `surface`, `format`, `playersCount`, `totalMinutes` | same | `format` is `group` for 3+ players |
| `focusAreas` | same | coarse client areas mapped from skill tags (`focusAreaOf`) |
| `blocks[].{kind,title,minutes,rationale,drills[]}` | same | `kind` is exactly the client's `warmup\|technical\|tactical\|live\|cooldown` |
| `blocks[].drills[]` = `SessionDrill` | same + `libraryDrillId` | `whatToDo` = objective + setup + numbered steps; `howToDo` = the cues; `reps` = `"sets × reps"` |
| `equipmentChecklist`, `coachingPrinciples`, `notes` | same | notes explain surface source, applied cap, dropped blocks, missing equipment list |

Everything below is new, and additive:

```jsonc
{
  "assemblerVersion": "v1",
  "seed": "…",                  // rebuild this exact proposal
  "templateId": "…",
  "targetMinutes": 90,          // what was asked for; totalMinutes is what was built
  "focusGoals": ["forehand_topspin"],   // the skill tags, beside the coarse focusAreas
  "intensityCapApplied": 3,     // 1–5, after fatigue / wellbeing
  "playerIds": ["…"],
  "confidence": { "level": "medium", "raisedBy": "…" },
  "cautions": [{ "code": "seek_qualified_assessment", "textEn": "…", "params": {} }],
  "preferencesApplied": ["<CoachPreference id>"],
  "excluded": [{ "drillId": "…", "code": "age_band", "textEn": "…" }],
  "droppedBlocks": ["cooldown"],
  "blocks": [{
    "slots": [{                 // the same drills as blocks[].drills, with the reasoning
      "drill": { "id": "…", "title": "…", "domain": "…", "skills": [], "patterns": [],
                 "defaultIntensity": "high", "requiresQualifiedSupervision": false,
                 "sourceBodies": ["…"], "status": "approved" },
      "appliedDefaults": { "durationMin": 15, "reps": 24, "sets": 2, "restSec": 60, "intensity": "medium" },
      "ranges": { "durationMin": [10, 25], "reps": [12, 40], "sets": [1, 4] },
      "minutes": 15,
      "score": 11.5,
      "reasons": [{ "code": "focus_goal_match", "params": {…}, "textEn": "…" }],
      "alternatives": [{ "drill": {…}, "sharedSkills": ["…"], "tier": "primary", "score": 9, "minutes": 12 }]
    }]
  }]
}
```

`appliedDefaults` is always the drill's own defaults clamped to the drill's own
`ranges`, with the intensity clamped to the session ceiling. `ranges` travels
with the slot so an editor can clamp an edit without another library lookup.

---

## The diff

`POST /api/sessions/:id/save` stores `final` (in exactly the same shape as
`proposal`) and a `diff` computed by the pure `diffSessions(proposal, final)`.
The diff **describes**; it never decides what a change means.

```jsonc
{
  "version": "v1",
  "added":    [{ "blockKind": "technical", "index": 0, "drillId": "…", "minutes": 12,
                 "intensity": "medium", "sourceBodies": ["…"],
                 "from": "alternative", "alternativeTo": "<the drill it stood beside>" }],
  "removed":  [{ …same ref…, "offeredAlternatives": ["…"], "replacedByAlternative": "…" }],
  "reordered":[{ "blockKind": "live", "drillId": "…", "from": 0, "to": 1 }],
  "changed":  [{ "blockKind": "warmup", "drillId": "…", "field": "minutes",
                 "before": 12, "after": 18, "override": false }],
  "blocksAdded": [], "blocksRemoved": ["cooldown"],
  "totals": { "before": 90, "after": 96 },
  "accepted": false,
  "counts": { "added": 1, "removed": 1, "reordered": 0, "changed": 1 }
}
```

`changed.field` is one of `minutes | reps | sets | restSec | intensity`.

### What Wave 1's preference learning will read

The diff deliberately records not only *that* something changed but enough about
it to compute a rule later **from stored diffs alone**, without re-running the
assembler:

| Wave 1 rule | Reads |
|---|---|
| `avoid_drill` | `removed[].drillId`, counted per coach over N proposals |
| `favour_drill` | `added[].drillId` where `from = "library"`, and slots kept untouched |
| `avoid_source` | `removed[].sourceBodies` — "removed a drill from source X three times" |
| `favour_source` | `added[].sourceBodies`, and `removed[].replacedByAlternative` resolved to its source |
| `intensity` | `changed[]` where `field = "intensity"`, direction of `before → after` |
| `duration` | `changed[]` where `field = "minutes"`, aggregated per `blockKind`; `totals.before/after` |
| `block_order` | `reordered[]`, and `blocksRemoved` / `blocksAdded` |

`accepted: true` (nothing changed at all) is the strongest positive signal there
is, and is recorded as its own flag so it does not have to be inferred from four
empty arrays.

---

## The routes

| Route | Who | Does |
|---|---|---|
| `POST /api/sessions/propose` | coach or admin | assembles and persists a `GeneratedSession` (`status: proposed`), returns `{ sessionId, proposal }` (**201**) |
| `POST /api/sessions/:id/save` | the owning coach | validates the edit, computes the diff, writes the training plan(s), returns `{ sessionId, diff, trainingPlanId, trainingPlanIds }` |
| `GET /api/sessions/:id` | the owning coach, or an admin of the same academy | the stored row |

### Authorization matrix

| | anonymous | player | coach (not assigned) | coach (assigned / owner) | admin, same academy | admin, elsewhere |
|---|---|---|---|---|---|---|
| `POST /propose` | 401 | 403 | 403 per player (`assertCanActOnPlayer`) — or 403 for a team they do not own | ✅ | ✅ | ✅ (subject to the same per-player check) |
| `POST /:id/save` | 401 | 403 | 403 | ✅ owner only | 403 | 403 |
| `GET /:id` | 401 | 403 | 403 | ✅ owner | ✅ (`assertSameAcademy`) | 403 |

Authorization runs **before** any player row, preference or library row is read —
the route tests assert that a 403 reads nothing.

Saving is owner-only *including for admins*: it writes into a player's training
plan in the coach's name, which is not an administrative act.

### Which drills a proposal may use

One predicate, `visibleDrillWhere()` in `server/src/library/visibility.ts`, shared
with the training-plan routes so "visible" cannot quietly mean two things:

- **visibility** — `global`, or `private` owned by this coach, or `academy` whose
  academy the coach is a member of;
- **status** — `approved` only, unless the request sets `includeReviewed: true`,
  which also admits `reviewed` rows.

**The choice made here** (the brief left it open): `includeReviewed` widens the
status filter across the coach's whole visible set, not only rows they own. The
reasoning is that `/propose` is always a coach building *their own* draft
proposal, nothing is published by proposing, and a `reviewed` drill has already
passed the agent review and is waiting only on a human's final sign-off — so a
coach who opts in is choosing to work from their academy's not-yet-approved
material with their eyes open. The default stays `approved`-only, the flag is
recorded in the persisted `constraints`, `status` travels on every slot's drill
so the UI can mark it, and **`/save` re-resolves drill ids with the same flag**,
so a coach cannot smuggle a `draft` or `retired` drill into a plan through the
save body.

`/save` additionally requires that every drill id in the edit is in the proposal,
among its offered alternatives, or elsewhere in that visible library — otherwise
**400**, and nothing is written.

### Values on save

Each edited value is clamped to the drill's `ranges` unless the slot carries
`override: true`, in which case the coach's number is kept as given and the diff
records `override: true` against it. A drill the coach added carries a single
`coach_edit` reason and no alternatives, so a reader can always tell the
assembler's work from the coach's.

The plan write reuses `createTrainingPlanWithDrills()` from
`server/src/trainingPlans/routes.ts` — the same code path the Session Builder
page uses today — with `origin = { model: "tennisai-session-assembler-v1",
promptVersion: "sa-1" }` and `TrainingDrill.libraryDrillId` set on every drill.
One plan per player.

---

## What v1 does **not** do

- **No AI.** No `/explain` route, no generated phrasing. Every sentence in a
  proposal is assembled from the drill's own text and a fixed reason vocabulary.
- **No learning.** `CoachPreference` rows are read, never written. The diff is
  stored so Wave 1 can derive them; nothing derives them yet.
- **No editor UI.** The proposal is a superset of the client `GeneratedSession`
  precisely so Wave 1 can start from the existing components.
- **No Spanish.** Reason and caution text is English-only; the codes and params
  are there so translation is a rendering change, not a rewrite.
- **No re-proposal loop.** A saved session is final (`409` on a second save); a
  coach who wants a different session asks for a new proposal, optionally with the
  same seed to reproduce one.
- **No cross-player differentiation.** One session is proposed for the whole
  group; per-player variants are a later wave.
