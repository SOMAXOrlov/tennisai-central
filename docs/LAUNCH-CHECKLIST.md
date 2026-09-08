# Launch checklist

Written at the end of the launch-polish sprint (September 2026) by the manager agent that
ran it. It records what shipped, how each claim was verified, what is left for a human, and
the four numbers worth watching after launch.

Nothing here claims the product is secure, penetration-tested, GDPR-approved or complete.
Where something was checked, this says how. Where it was not, it says so.

---

## 1. What shipped

Seventeen pull requests, #18 through #35, merged into `main`.

### Launch polish (the sprint proper)

| Wave | Workstream | PR | What landed |
|---|---|---|---|
| 0 | Foundations | #20 | Package renamed, page title and social tags, installable to a home screen with an offline app shell, Spanish/English scaffolding with a language switch, four dashboards migrated |
| 1 A | First run | #24 | Considered empty states on 14 list pages; a "get started" checklist on each of the four dashboards whose ticks come from real data, never a stored flag |
| 1 B | Courtside mobile | #27 | Two-tap quick actions in the phone header (a coach logs a training, a player enters a score); eight forms become bottom sheets on a phone; 27 controls enlarged to a 44 px touch target; no horizontal overflow on any of 50 page-and-role combinations |
| 1 C | Surface the differentiators | #28 | Always-visible playing-conditions panel with an honest label for the kind of weather data; feed provenance chips with freshness; next-tournament card; remaining AI generations shown where they are spent |
| 1 D | States and feedback | #31 | Content-shaped loading skeletons across 18 views; errors that say what failed and retry properly instead of reloading the page; one toast system; recoverable per-page crashes with a "copy diagnostics" button that carries no account data |
| 1 E | Accessibility and design | #23 | 92 colour pairs measured, 21 failures fixed; a visible keyboard focus ring everywhere; 47 form controls given proper labels; a design-tokens document |
| 1 F | Trust and ops | #26 | Public `/status` page; hardened health endpoint; an executed backup-restore drill on the production host; monitoring documentation; `CONTRIBUTING.md` and `SECURITY.md` |
| 2 G | Landing and legal | #33 | Bilingual landing page with real screenshots; legal pages rewritten against what the code actually does, with company details as visibly unresolved tokens |
| 2 H | i18n completion | #34 | Every user-visible string translated (2,177 keys per language, no difference between them); dates, numbers and currency through `Intl`; a test that fails the build on new hard-coded text |
| — | Lint and CI | #35 | Both packages lint-clean; CI now fails on lint |
| — | Hotfixes | #25, #32 | Duplicate imports left by merges that git reported as conflict-free |

### Features built alongside

| Sprint | PR | What landed |
|---|---|---|
| Coach entity menu | #19 | Schedule, Calendar, Stats and Equipment on every player; Schedule, Calendar and Manage team on every team, with the target page pre-filtered |
| Gear catalogue and advice | #22 | Product catalogue with honest provenance, string-setup history, admin CSV import, and three deterministic recommendation engines (strings, tournament fit, money) with reasons and confidence |
| Coaching knowledge base | #21, #30 | Drill content schema and validator, ten reviewed exemplar drills with fetch-verified sources, and a deterministic session assembler |
| Match issues | #29 | Tap a player's avatar for the menu, team chips on player cards, post-match issue tagging by player and coach, and a computed summary of what recurs |

---

## 2. What was verified, and how

| Claim | How it was checked |
|---|---|
| The app builds and its tests pass | Every pull request gated independently after rebasing onto `main`: frontend type-check, tests, production build; backend schema validation, type-check, tests. Final state: **69 frontend test files / 737 tests**, **62 backend files / 1,005 tests**, both builds clean |
| A new person can set it up | A clean clone against an empty database, following `README.md`: **3 minutes 3 seconds** to a running app with a health check and a demo login both returning 200. Target was ten minutes |
| Colour contrast meets AA | All 92 foreground/background pairs the app renders, measured in both themes; 21 failures fixed. A test now fails if the calendar palette drifts |
| Keyboard navigation works | Every focus stop on the four dashboards, the calendar, a dialog and a sheet, walked and read back: every stop visible, focus contained, no traps |
| Phones are usable | 50 page-and-role combinations at 390x844: no horizontal overflow anywhere; 27 undersized controls fixed |
| Backups can be restored | A real dump restored into a throwaway container on the production host: 8.2 seconds, 33 of 34 tables identical to live, the one difference explained. Recorded in `deploy/hetzner/RESTORE.md` |
| Both languages stay in step | 2,177 keys in each locale file with zero difference, enforced by a test |
| Style stays clean | Both packages at zero lint problems, and CI fails on a single new warning |

### What was NOT verified

- No screen reader was driven. Roles, labels and live regions are verified structurally.
- No real phone or tablet. Everything mobile was emulated.
- Spanish was written and reviewed by an agent, not by a native speaker.
- No external penetration test and no formal data-protection assessment.
- The AI features were exercised against a deterministic stand-in, not a real provider.
- The live restore path on production (stop, wipe, restore, start) was rehearsed in a throwaway container only, never executed against the real database.

---

## 3. What remains for a human

**Before a public launch**

1. **Fill in the company details.** `src/lib/legal/companyDetails.ts` holds six placeholders that render visibly unresolved on the legal pages: name, address, contact email, data-protection email, jurisdiction and effective date. Until they are filled, a privacy request has nowhere to go and the "book a demo" button opens a mail window addressed to nobody.
2. **Take the legal pages to a lawyer.** The privacy page lists its open items on the page itself, and the processor list needs an agreement with each named party. *Settled since:* the age of digital consent now enforces **14**, Spain's age, and a test holds the policy copy in both languages to that number — see `server/src/auth/__tests__/ageInLegalCopy.test.ts`. The residual question is a player resident in a member state that sets 16, and it is on the page's own open list.
3. **Approve the coaching drills.** Ten drills ship as `reviewed`; only `approved` ones are imported, so the session assembler correctly refuses to build from them. **Correction:** an earlier version of this checklist said approval is "a deliberate human decision inside the app". There is no such thing. `server/src/library/` contains no routes, no drills router is mounted, and `prisma.drillReview` has zero writes anywhere in the codebase — the review table is dead. Approval is: change `status: reviewed` to `approved` in the ten files under `content/drills/`, then re-import. The mechanical part is trivial; what it needs is a coach reading the ten drills and judging the content sound for children.
4. **Buy a domain and point it at the server.** The app answers on an IP-derived hostname. `deploy/hetzner/DOMAIN.md` has the DNS records, the one config change and the order to do them in, so this is a purchase followed by about five minutes of work.
5. **Decide about payments.** Out of scope for this sprint by instruction. Nothing payment-related was built.

**Operationally**

6. **Deploy.** `deploy/hetzner/update.sh` on the production host. Several additive migrations are waiting; they apply automatically during deploy.
7. **Turn on monitoring.** `deploy/hetzner/monitoring/` documents the health URL, the expected response, an interval and thresholds, with a sample monitor configuration. No account exists yet.
8. **Copy backups off the machine.** Backups are written on the same server they protect.
9. **Decide about the AI features.** They are off. With no provider key the app says so honestly. Configuring one turns on match preparation and sends prompt text off the server, which the privacy policy already discloses.

---

## 4. The four numbers to watch weekly

1. **Paying academies.** Zero today; the product is a free trial. The first number that matters.
2. **Weekly active families.** A family is active when a player logs a match or a training, or a parent opens the week. Retention shows here first.
3. **Monthly recurring revenue.** Zero until pricing exists. Track it from the first paid account so the trend starts with real data.
4. **AI cost per academy.** Zero while the provider is off. The moment it is on, this decides whether the feature can be included in a price.

---

## 5. Known gaps, recorded rather than hidden

- The parent's "review consent" checklist item is self-confirmed, because consent lives on the child's account and never reaches the parent's session.
- The admin checklist has one item rather than two: creating an academy and assigning coaches have no interface yet.
- The observer's "confirm attendance" quick action was not built: the endpoint is coach-only and a parent cannot read a child's trainings, so the action could never succeed.
- The tournament fit engine cannot use distance, because no profile field stores a home location.
- The next-tournament card shows no "prepared" status, because nothing exposes preparation runs per tournament to the client.
- The frontend's unused-variable lint rule is still off; enabling it costs 53 fixes and belongs in its own change.
- Four vendored interface primitives are exempt from the translation check because nothing renders them.
