# Counsel pack — TennisAI privacy policy and terms

## Read this before anything else

**This document was assembled from the source code by an AI agent.** It is not
legal advice, it was not written or checked by a lawyer, and it carries no
professional judgement of any kind. Every statement in it should be treated as a
**starting point for verification, not a finding**. Where it says "backed by
`file:line`", that means a machine read that line and believed it said so — it does
not mean the line has been independently confirmed, that the code behaves that way
under load, or that the described behaviour is lawful.

The product has not been certified, audited or approved by anybody. Nothing here
should be read as a claim that it is compliant, secure, or fit for launch.

**Everything below was read at commit `edcb433`** of the repository. It describes the
code, not the running server: where a fact depends on how the live machine was
configured by hand, this document says so instead of guessing.

Two conventions used throughout:

- `file:line` citations are relative to the repository root. Policy text lives in
  `src/locales/en.json`; a citation like `en.json:1009` is the line holding that
  string.
- Where the code and the policy disagree, or where a claim has no code behind it, the
  row says so plainly. Those rows are the reason this document exists.

---

## 1. What the product is

TennisAI is a shared record-keeping and planning tool for tennis coaching. Four kinds
of account use it (`server/prisma/schema.prisma:20`): a **player**, a **coach**, an
**observer** — which is how a parent or guardian holds an account — and an **admin**
for an academy. **Some players are minors, and that is the intended market**: the code
comment explaining the guardian-consent feature states plainly that the product ships
junior tournament calendars and that a 14-year-old is the archetypal user
(`server/src/auth/guardianConsent.ts:5-8`).

What it does: coaches and players record training sessions and reviews, match scores
and post-match issues, tournament entries, calendar events and training requests; a
rule-based builder assembles a session plan from a library of coaching drills; further
rule-based engines suggest a string setup and tension, assess how a player fits an
upcoming tournament, and total up what a season has cost from figures the user typed
in. A player may upload **one profile photograph** of themselves — the only file
upload in the product. Optional AI text generation exists but is switched off unless
an operator supplies a provider key.

**Where it runs.** One rented server, three containers: a web server, the API, and a
PostgreSQL database (`deploy/hetzner/docker-compose.yml:14-133`). The database and the
API publish no ports to the internet; only the web server is reachable. Uploaded
photographs sit on a disk volume attached to the API container and are deliberately
not reachable by the web server, which carries an explicit instruction never to serve
them directly (`deploy/hetzner/Caddyfile:23-33`). The backup is written nightly to the
same disk (`deploy/hetzner/backup.sh`).

**The provider is Hetzner** — the deployment directory is named for it and the runbook
refers to the Hetzner Cloud Firewall (`deploy/hetzner/README.md:38`). Hetzner is a
German company, and the policy says so (`en.json:1025`, `en.json:1036`). **The
data-centre location is not established.** Nothing in the repository records which
country this particular server physically sits in, and the policy is explicit about
that rather than guessing (`en.json:1036`). Counsel should treat the location as an
open fact to be obtained from the hosting account, not from this document.

**Commercial status: pre-launch, no paying users.** The terms state there is no paid
plan, no price, no card and no payment processor (`en.json:1123-1126`). The launch
checklist records paying academies as "Zero today; the product is a free trial"
(`docs/LAUNCH-CHECKLIST.md:88`). There is a dormant `Subscription` table in the
schema with a plan tier (`schema.prisma:1200-1214`), written only by the synthetic
demo seed (`server/prisma/seed.ts:444`).

**Provenance of the documents themselves.** The privacy policy and terms were written
by the project team from the code — not from a template — and have never been reviewed
by a lawyer. The pages say so on their face: a draft notice appears above the title
(`en.json:864-865`), the company details render as visibly unresolved placeholders,
and the policy ends with a twelve-item "Still open" list (`en.json:1092-1106`). The
Spanish version was written and reviewed by an agent, not by a native speaker
(`docs/LAUNCH-CHECKLIST.md:60`).

---

## 2. Every factual claim the policy makes about the software

This is the table to spot-check. The policy was written from the database schema and
the API routes; each row here names the file that backs the claim, so a line can be
checked without reading TypeScript.

**The four statuses, defined:**

| Status | Means |
|---|---|
| **Backed** | A machine read code that says this. |
| **Backed, with caveat** | True as the product behaves today, but something adjacent is worth knowing. The caveat is the point of the row. |
| **Not found in code** | The claim asserts something about the software and no backing code was located. **These are the rows to read first.** |
| **Not a code matter** | A promise, a statement of law, or a commitment about future conduct. No code could back it, and its absence is not a gap. |

### 2.1 Who is responsible, and who is covered

| Claim (and where it is written) | What the code shows | Where | Status |
|---|---|---|---|
| None of the four controller fields has been decided (`en.json:877`) | All seven company values are unresolved `{{TOKEN}}` literals | `src/lib/legal/companyDetails.ts:28-52` | Backed |
| Used by players, coaches, parents as observer accounts, and academy admins (`en.json:885`) | Four role strings on the user record: `player`, `coach`, `observer`, `admin` | `schema.prisma:20` | Backed |
| A junior's own account is not usable until a guardian has approved it (`en.json:885`) | Login refuses while consent is required and not yet given | `server/src/auth/guardianConsent.ts:9-10`; `server/src/auth/routes.ts:400-405` | Backed |
| A parent or guardian "normally holds the connected observer account" (`en.json:885`) | Nothing in the code links an observer account to a specific child in production — see the guardianship row in 2.2 | — | Not a code matter (a description of intended use) |
| The table of data categories is exhaustive: "if something is not in this table, the product does not hold it" (`en.json:889`) | All 48 models in the schema were checked against the 14 rows plus the dormant paragraph. Every model holding personal data is accounted for, with two thin spots: `Subscription` (a user id plus a plan tier) is covered only obliquely as "the plan tier", and `Drill.approvedById` — the identity of whoever approves a coaching drill — is not mentioned anywhere. Neither is written by any route today | `schema.prisma:1200-1214`, `schema.prisma:1031`; verified no `create`/`upsert` outside `prisma/seed.ts` | Backed, with caveat |

### 2.2 The fourteen data categories

| Claim (and where it is written) | What the code shows | Where | Status |
|---|---|---|---|
| **Account:** name, e-mail, role, a shareable directory id, password only as a bcrypt hash, whether the address is verified, the moment the terms were accepted (`en.json:900`) | All present on the user record. `publicId` is described in the schema as a shareable directory id; `termsAcceptedAt` is set at signup. Passwords are hashed with bcrypt at cost 12 and never stored otherwise | `schema.prisma:15-26`; `server/src/auth/routes.ts:88,246` | Backed |
| **Age and guardian consent:** date of birth, the age confirmation, and for a minor a guardian's name and e-mail, a one-time token stored only as a hash, and when consent was given (`en.json:906`) | Exactly those columns exist. The raw token is never stored — the handler hashes the incoming token and looks up the digest | `schema.prisma:43-48`; `server/src/auth/routes.ts:430` | Backed |
| **Playing profile:** level, ranking, hand, backhand, surface, strengths, style ratings, goals, onboarding answers (`en.json:912`) | A dedicated profile model holds these | `schema.prisma:658-706` | Backed |
| **Photo:** one photograph, re-encoded by the server into a square WebP of at most 512 pixels; the chosen file is never stored (`en.json:918`) | Maximum edge 512, stored type WebP, and the upload is parsed into memory rather than to a temp file precisely so the original bytes never touch the disk | `server/src/photos/storage.ts:57,63,175`; `server/src/photos/routes.ts:57-60` | Backed |
| **Activity:** trainings with blocks and reviews, the player's own feedback, matches with set scores and the issues raised, tournament entries, hidden tournaments, calendar events, training requests (`en.json:924`) | A model for each | `schema.prisma:130,217,257,325,339,418,452,765,898` | Backed |
| **Plans:** a saved plan and its drills stamped with which generator produced it; for a built session, the constraints, the proposal, the coach's edits, and whether it was kept (`en.json:930`) | Plan and drill models, plus a generated-session model holding constraints, proposal and diff | `schema.prisma:916,940,1109` | Backed |
| **Equipment:** rackets, strings, shoes, accessories, and string setups with tension, dates and how each ended (`en.json:936`) | Equipment-item and string-setup models | `schema.prisma:512,1480` | Backed |
| **Finance:** amount, currency, category, description, date, optional tournament (`en.json:942`) | A finance-entry model with those fields | `schema.prisma:481-510` | Backed |
| **Connections:** connection requests, team membership, notifications about them, notification and calendar preferences (`en.json:948`) | A model for each | `schema.prisma:397,379,542,569,591` | Backed |
| **Coach's private notes:** the table exists, deliberately separate, but nothing in the app writes to it, so no note has ever been recorded (`en.json:954`) | The model exists; no `create`, `upsert` or `update` call against it anywhere outside tests | `schema.prisma:708`; verified by search | Backed |
| **Opponents:** a name, tendencies and written observations about someone who usually has no account, plus reserved-and-unwritten tables for scouting reports and game plans (`en.json:960`) | The opponent model exists and is written by routes; the scouting-report and game-plan models have no write calls anywhere | `schema.prisma:726,817,842`; `server/src/opponents/routes.ts` | Backed |
| **Push:** the endpoint the browser's push service issues, the two keys, and the browser's self-description (`en.json:966`) | Exactly four columns: endpoint, `p256dh`, `auth`, `userAgent` | `schema.prisma:615-622` | Backed, with caveat — see 2.5 on push being unreachable in this deployment |
| **AI records:** provider, model, a hash of the input, whether it succeeded, any error, how long it took — and neither the prompt nor the answer (`en.json:972`) | Exactly those columns, and no prompt or response column | `schema.prisma:1178-1191` | Backed |
| **Technical:** request logs from the API and the web server, including IP addresses, and the sign-in token the browser holds (`en.json:978`) | The API logs in Apache "combined" format in production, which includes the client address; the web server writes its own access log; the token is kept in browser local storage | `server/src/index.ts:51`; `deploy/hetzner/Caddyfile:41-45`; `src/auth/AuthContext.tsx:37` | Backed |
| No health or medical question is asked, and there is no field for one; two columns for injury restrictions and physical limitations exist and are read by the session and string builders, but nothing writes to them (`en.json:984`) | Both columns exist, both are selected by the session builder and the recommender, and the onboarding code carries an explicit comment that it deliberately does **not** persist into them. No write found anywhere | `schema.prisma:679,684`; `server/src/sessions/load.ts:207-208`; `server/src/recommend/load.ts:58-59`; `server/src/profile/onboardingProfile.ts:52-53` | Backed |
| Several tables are reserved and empty — private coach notes, scouting reports, game plans, post-match reports, session templates, coach preferences, drill reviews, the plan tier (`en.json:985`) | No write call for any of them outside the demo seed (the session-template model is written by the seed alone) | `schema.prisma:708,817,842,870,1093,1138,1157,1204`; `server/prisma/seed.ts:495` | Backed |
| The guardianship, coach-assignment and academy-membership tables are read by the authorisation checks but filled only by the synthetic demo data (`en.json:985`) | All three are read by the authorisation module; the only writes anywhere are in the demo seed | `server/src/authz.ts:72,95,221`; `server/prisma/seed.ts:420,428,436` | Backed — and see question 4 in section 3, because a live consequence follows from it |

### 2.3 Photographs

| Claim (and where it is written) | What the code shows | Where | Status |
|---|---|---|---|
| A photograph is optional; nothing requires one (`en.json:994`) | No route or schema constraint requires it | `schema.prisma:658-706` | Backed |
| The re-encode removes the photograph's metadata, including the coordinates a phone records (`en.json:995`) | The image is decoded, auto-oriented, cropped and re-encoded to WebP; nothing copies metadata across | `server/src/photos/storage.ts:153-176` | Backed |
| Stripping metadata in the browser was considered and rejected because the original file can be sent straight to the server (`en.json:995`) | The reasoning is recorded in the code comments | `server/src/photos/routes.ts:57-60` | Backed (a design rationale, not a behaviour) |
| For an account below the age of digital consent, a photograph can be read by exactly three kinds of person: the player, an actively assigned or connected coach, and a guardian whose consent has actually been recorded (`en.json:996`) | The check is: self returns immediately; otherwise player-or-coach (an active assignment, or a connection **only when the actor's role is coach**); failing that, a guardianship row whose `parentalConsent` is true | `server/src/authz.ts:194-216,136-163,71-79` | **Backed, with caveat.** The guardian branch checks a table that no production route ever writes (see 2.2). In practice a real parent has no such row, so today the third category is empty and no parent can see a minor's photograph. Counsel should read this claim as describing an intended rule, not an operating one |
| That decision is made on the server on every request, from stored relationships — not by which buttons the app shows (`en.json:997`) | Authorisation runs inside the route handler before the file is looked up | `server/src/photos/routes.ts:239` | Backed |
| A photograph has no address of its own; no URL serves it; the file name is 32 random characters; authorisation runs before existence so the answer cannot reveal whether a child has a picture (`en.json:998`) | The file name is 16 random bytes rendered as hex — 32 characters. The web server has no route for the uploads volume and carries an explicit prohibition against adding one. The refusal and the not-found reply share a byte-identical body | `server/src/photos/storage.ts:108-110`; `deploy/hetzner/Caddyfile:23-33`; `server/src/photos/routes.ts:47-52` | Backed |
| Only you can put a photograph on your own profile; no route lets a coach, parent or administrator upload one for somebody else (`en.json:999`) | The upload route is self-only and the code states the reason | `server/src/photos/routes.ts:5,11-15` | Backed |
| Removing or replacing a photograph deletes the file immediately, but the nightly backup keeps fourteen archives, so a copy survives for up to fourteen nights (`en.json:1000`) | The delete route removes the file; the backup script archives the uploads directory alongside the database dump and keeps 14 of each | `server/src/photos/routes.ts:181`; `deploy/hetzner/backup.sh:22,58-62` | Backed |

### 2.4 Minors, cookies and device storage

| Claim (and where it is written) | What the code shows | Where | Status |
|---|---|---|---|
| The account is created but stays inert below the threshold; a one-time link goes to the guardian's e-mail; until they approve, the account cannot be used (`en.json:1004`) | That is the described and tested behaviour, including when no mail transport exists — in which case the account is created, marked consent-required, and **no token is minted at all** | `server/src/auth/guardianConsent.ts:6-10`; `server/src/auth/guardianConsentNoMail.routes.test.ts:1-17` | Backed, with caveat — see question 6 |
| "the age of digital consent this deployment is configured with — **16 unless the operator changes it**" (`en.json:1004`, repeated in the terms at `en.json:1132`) | The default is 16. The threshold is read from an environment variable at every call. **But the deployment recipe passes no such variable to the API container, and the container's `.env` file is excluded from its image, so nothing can set it.** The deployed API therefore enforces 16, and an operator cannot change it without editing the compose file | `server/src/auth/guardianConsent.ts:26-27,49-50`; `server/.env.example:32`; `deploy/hetzner/docker-compose.yml:36-77`; `server/.dockerignore:2-3` | **Backed as to 16; the words "unless the operator changes it" are not accurate for this deployment.** See question 7 |
| GDPR Article 8 leaves the exact age to each member state, 13 to 16, which is why it is a setting (`en.json:1004`) | The code comment says the same, naming Spain 14, Germany 16, Ireland 16, Denmark 13 | `server/src/auth/guardianConsent.ts:12-16` | Not a code matter (a statement of law) |
| The app sets no cookies at all, so there is no consent banner (`en.json:1009`) | No server response sets a cookie, and no application code writes `document.cookie`. **One file does**: an unused user-interface component from a third-party component library writes a `sidebar_state` cookie. Nothing in the app imports it, so it is never rendered and never bundled | `src/components/ui/sidebar.tsx:68`; verified no import of that module anywhere | **Backed, with caveat.** True of behaviour today. One import would make it false, silently, with no banner |
| The browser keeps: the sign-in token; the language and theme choice; an approximate location only if the map is asked for distances; get-started checklist progress; drafts of long forms; small interface preferences (`en.json:1011-1016`) | Each has an identifiable writer: token, language, location, checklist, form drafts, and the collapsed-navigation flag. **The theme is the exception** — it is stored by the `next-themes` dependency's own default, not by a line of this project's code | `src/auth/AuthContext.tsx:37`; `src/lib/i18n.ts:24`; `src/hooks/useGeolocation.ts:20,39`; `src/components/dashboard/getStartedStorage.ts:49`; `src/lib/drafts/useFormDraft.ts:32`; `src/layouts/DashboardLayout.tsx:34`; `src/components/ThemeProvider.tsx:1-14` | Backed, with caveat |
| The approximate location stays on the device and is never sent to the server; distances are worked out in the browser (`en.json:1013`) | The hook records exactly that, and no request body carries the coordinates | `src/hooks/useGeolocation.ts:1-7,39` | Backed |
| Only the sign-in token is strictly necessary; the app works without the rest (`en.json:1017`) | Each of the other writers is wrapped so that a failure to store degrades quietly | `src/layouts/DashboardLayout.tsx:34`; `src/components/dashboard/getStartedStorage.ts` | Backed, with caveat — "strictly necessary" is a legal characterisation, not a code fact |
| The service worker caches the app's own program files and is written never to store a reply from the API (`en.json:1018`) | A hard rule stated at the top of the file, an explicit predicate for API requests, and a handler that returns before any cache logic for them | `public/sw.js:13-14,32-34` | Backed |
| Two things the browser fetches do not come from this app's server: three typefaces, and the map tiles (`en.json:1019`) | The stylesheet imports three font families from Google Fonts; the map component requests OpenStreetMap tiles | `src/index.css:3`; `src/components/tournaments/TournamentMap.tsx:224` | Backed |

### 2.5 Who else the data touches, and where it goes

| Claim (and where it is written) | What the code shows | Where | Status |
|---|---|---|---|
| App, API, database and photographs all run on one rented server (`en.json:1025`, `en.json:1035`) | Three containers on one host; the database and API publish no ports | `deploy/hetzner/docker-compose.yml:14-133` | Backed |
| The machine is rented from a German hosting company; which data centre it sits in is not recorded anywhere in this project (`en.json:1025`, `en.json:1036`) | The repository names Hetzner (a directory name and a firewall reference) and records no location whatsoever. **The word "German" is not stated anywhere in the repository** — it follows from knowing who Hetzner is, not from the code | `deploy/hetzner/README.md:38`; directory `deploy/hetzner/` | Backed, with caveat — the "not recorded" half is verified by absence; the nationality is outside the code |
| That company operates data centres in more than one country, including outside the EEA (`en.json:1036`) | Nothing in the repository says this | — | **Not found in code.** A fact about the provider, to be confirmed from the hosting account |
| Verification, password-reset and guardian-consent e-mail goes through an external mail provider configured by the operator; the trial's provider has not been named (`en.json:1026`) | Either Gmail or any SMTP provider, both driven by environment variables; the generated configuration ships every mail credential blank and e-mail verification switched off | `server/src/env.ts`; `deploy/hetzner/docker-compose.yml:46-56`; `deploy/hetzner/setup.sh:64-79` | Backed |
| Web push is relayed by the browser's push service, and is off unless the operator configures keys (`en.json:1027`) | Three optional VAPID variables exist and push self-disables without them. **The deployment recipe passes none of them to the API container**, so push cannot be switched on in this deployment without editing the compose file — the same pattern as the age threshold | `server/src/env.ts:100-107,182-184`; `deploy/hetzner/docker-compose.yml:36-77` | Backed, with caveat |
| An AI provider is optional and off unless the operator sets both a provider and a key; when on, the text of a prompt is sent to it (`en.json:1028`, `en.json:1046`) | Two providers are reachable in code, both gated on configuration, and the compose file passes both variables through empty by default | `server/src/ai/provider.ts:14,120,138`; `deploy/hetzner/docker-compose.yml:61-62` | Backed |
| "On this trial it is switched off" (`en.json:1028`) | Default is empty, so a default deployment is off — but whether the live machine has a key is a runtime fact | `deploy/hetzner/docker-compose.yml:61-62` | Backed, with caveat — not verifiable from the code |
| The server asks the public Open-Meteo API about a tournament's coordinates, sending no account or personal data (`en.json:1029`) | Three request URLs, each carrying latitude and longitude only | `server/src/conditions/weather.ts:115,134,174` | Backed |
| The stylesheet loads three typefaces from Google, so Google sees the visitor's IP and browser on every visit whether or not they are signed in (`en.json:1030`) | A single global stylesheet import of three families, so it loads on every page including public ones | `src/index.css:3` | Backed |
| Map tiles come from the OpenStreetMap Foundation's public servers, and only when the map is opened (`en.json:1031`) | The tile URL sits inside the map component, which only mounts on the map view | `src/components/tournaments/TournamentMap.tsx:224` | Backed |
| There is no second region and no second copy: one machine, one disk, a nightly backup on that same disk (`en.json:1035`) | One host, and the backup script writes locally | `deploy/hetzner/docker-compose.yml`; `deploy/hetzner/backup.sh` | Backed |
| The two AI providers the code can talk to are Anthropic and OpenAI, both United States companies (`en.json:1038`) | The two provider names and their two request URLs are in the code. **The statement that they are US companies is not in the repository** | `server/src/ai/provider.ts:14,120,138` | Backed as to the providers; the nationality is outside the code |
| No transfer mechanism is recorded anywhere in this project for any recipient outside the EEA — no standard contractual clauses, no documented reliance on an adequacy decision, nothing (`en.json:1042`) | A search of the whole repository for those terms returns only this sentence of the policy itself | verified by absence | Backed |

### 2.6 AI, automated decisions, security, retention, rights

| Claim (and where it is written) | What the code shows | Where | Status |
|---|---|---|---|
| What would leave the server is evidence, not identities: names and e-mail addresses are replaced with "Player 1", "Player 2" and swapped back in the answer (`en.json:1047`) | Players are labelled `Player 1..n` in the prompt and the label is swapped back for the real first name afterwards. **E-mail addresses are not "replaced" — they are never selected into the prompt at all**, which is stronger, but is not what the sentence describes | `server/src/ai/routes.ts:218,358`; `server/src/ai/trainingAdvice.ts:145,207,288`; `server/src/ai/matchPrep.ts:65` | Backed, with caveat |
| But the free text is sent as written, so a name typed into a session goal or a match note goes with it (`en.json:1047`) | Free-text fields are passed through unmodified | `server/src/ai/trainingAdvice.ts` | Backed |
| The answer is checked against a strict shape before it is shown, and the record kept holds provider, model, input hash and outcome — not the prompt and not the answer (`en.json:1047`) | Output validation exists, and the record model has no prompt or response column | `server/src/ai/routes.ts`; `schema.prisma:1178-1191` | Backed |
| The recommendation engines are deterministic: same inputs, same answer, every rule written down, each answer returned with its reasons (`en.json:1051`) | Rule-based engines that return reason codes with each result | `server/src/recommend/tournaments.ts:283-393` | Backed |
| Two automated rules settle something rather than suggest it: the sign-up age gate, and tournament age eligibility, which removes an event from the list with the reason shown (`en.json:1053-1054`) | The age gate is the guardian-consent path; the eligibility rule parses an "N & under" category and excludes the event with a reason string | `server/src/auth/guardianConsent.ts`; `server/src/recommend/tournaments.ts:200-291` | Backed |
| Nothing here profiles anyone and none of it is used for advertising or sold (`en.json:1055`, `en.json:989`) | No analytics, advertising or tracking library appears anywhere in the client or the page shell | verified by absence | Backed by absence — no code sells or advertises; whether the product ever will is a commitment, not a code fact |
| Whether the sign-up gate counts as an automated decision in the legal sense has not been assessed by a lawyer (`en.json:1055`) | — | — | Not a code matter (an admission) |
| Passwords are kept only as bcrypt hashes and no part of the system can read one back (`en.json:1060`) | Hashed at cost 12 on signup and on reset; only ever compared, never decoded | `server/src/auth/routes.ts:88,246,355,558` | Backed |
| Traffic travels over HTTPS with the certificate obtained and renewed automatically (`en.json:1061`) | The web server is configured with a hostname, which makes it obtain and renew a Let's Encrypt certificate itself | `deploy/hetzner/Caddyfile:1-7`; `deploy/hetzner/setup.sh:47-51` | Backed |
| Who may read what is decided on the server on every request from recorded relationships; what the app displays is never the boundary (`en.json:1062`) | A single authorisation module, called from the route handlers | `server/src/authz.ts` | Backed |
| The database and the API accept no connections from the internet — only the web server is reachable (`en.json:1063`) | Neither container publishes a port, and the database service carries an explicit comment saying why | `deploy/hetzner/docker-compose.yml:24-25,32-99` | Backed |
| Sign-in attempts, photograph uploads and ordinary requests are each rate-limited per address (`en.json:1064`) | Three limiters: 30 per 15 minutes on authentication, 20 per 15 minutes on photo writes, 300 per 15 minutes on the rest | `server/src/index.ts:54-56,71-72,82-84,96,106,132` | Backed |
| An uploaded image is identified by its actual bytes rather than its name or declared type, capped at five megabytes, and re-encoded before anything is stored (`en.json:1065`) | Byte-signature sniffing, a 5 MB cap enforced both on the declared length and on the stream, and re-encoding | `server/src/photos/storage.ts:46,121-145`; `server/src/photos/routes.ts:69,98` | Backed |
| No external security review or penetration test of any kind; everything was done by the people who wrote the code (`en.json:1066`) | The security register says exactly this | `SECURITY.md:177-180` | Backed |
| The web app is served without a Content-Security-Policy header (`en.json:1066`) | The web server sets three headers — content-type options, frame options, referrer policy — and no CSP | `deploy/hetzner/Caddyfile:35-39` | Backed |
| The sign-in token is kept in local storage rather than in a cookie the page cannot read, so a scripting flaw anywhere would expose it (`en.json:1066`) | The token is read from and written to browser local storage | `src/auth/AuthContext.tsx:37`; `src/api/client.ts:27` | Backed |
| The nightly backup is unencrypted, on the same disk as the data it protects, with no copy anywhere else (`en.json:1066`) | Confirmed in the security register and by the backup script writing locally | `SECURITY.md:166-167`; `deploy/hetzner/backup.sh` | Backed |
| The procedure for restoring the photograph archive has been written down but never executed (`en.json:1066`) | The restore document states that half has not been drilled; the database half was drilled on 5 September 2026 against a throwaway container | `deploy/hetzner/RESTORE.md:17,20-22`; `SECURITY.md:172-175` | Backed |
| Retention is "for as long as the account exists"; no automatic deletion schedule is implemented and no retention period has been agreed (`en.json:1071`) | No scheduled deletion or purge job exists. The only timer in the API refreshes tournament calendars | verified by absence; `server/src/tournaments/schedule.ts:3` | Backed |
| Two things have a real number: fourteen nightly backups of the database and of the photograph directory, and five rolled access-log files of ten megabytes (`en.json:1072`) | 14 kept of each archive; roll size 10 MiB, roll keep 5 | `deploy/hetzner/backup.sh:22,58-62`; `deploy/hetzner/Caddyfile:41-45` | Backed |
| Erasure is requested in writing and **will be acted on within one month** (`en.json:1077`) | Nothing in the code implements, tracks or enforces a deadline | — | Not a code matter (an operational promise) |
| There is no "delete my account" button, and nothing in the product closes an account (`en.json:1077`, `en.json:1104`) | **14** delete endpoints exist across the API — calendar events, connections, equipment, match issues, matches, notifications, opponents, one's own photo, string setups, teams, team members, player tournaments, hidden tournaments, trainings. **None of them touches a user record, and no `user.delete` call exists anywhere in the server or its seed** | `server/src/calendar/routes.ts:322`, `connections/routes.ts:243`, `equipment/routes.ts:79`, `matches/issues.routes.ts:158`, `matches/routes.ts:569`, `notifications/routes.ts:178`, `opponents/routes.ts:234`, `photos/routes.ts:181`, `stringSetups/routes.ts:218`, `teams/routes.ts:106,139`, `tournaments/routes.ts:774,835`, `trainings/routes.ts:698`; `SECURITY.md:181-190` | Backed |
| What a person can do themselves is remove their own profile photograph, which deletes the file at once (`en.json:1078`) | The self-only delete route removes the file | `server/src/photos/routes.ts:181` | Backed |
| Requests go to the data-protection contact "once that address exists"; until then there is nowhere to send one (`en.json:1079`) | The address is an unresolved placeholder | `src/lib/legal/companyDetails.ts:37` | Backed |
| Rights available "depending on where you live", and a guardian may exercise them on a minor's behalf (`en.json:1076`) | — | — | Not a code matter (a statement of law) |
| Which supervisory authority is competent follows from establishment and governing law, and that field is undecided (`en.json:1083-1085`) | The jurisdiction value is an unresolved placeholder, and the page names no regulator | `src/lib/legal/companyDetails.ts:40`; `src/pages/legal/PrivacyPolicyPage.tsx:305-314` | Backed |
| The effective date is written by hand and does not advance on its own (`en.json:1089`) | A string constant with a comment forbidding a computed date, and the page renders that constant | `src/lib/legal/companyDetails.ts:42-49`; `src/pages/legal/PrivacyPolicyPage.tsx:147-151` | Backed |
| There is no archive of superseded versions, so a reader cannot see what a previous version said (`en.json:1090`) | No versioning or archive of the legal copy exists | verified by absence | Backed |
| A change that matters will be told to trial participants directly rather than relying on anyone re-reading the page (`en.json:1090`) | — | — | Not a code matter (a commitment) |

---

## 3. The questions counsel needs to answer

Each question below carries the context needed to answer it and what turns on the
answer. They are ordered by how much depends on them, not by how hard they are.

### 1. The lawful basis for each of the fourteen data categories

**Context.** The policy's basis column says "Not settled" in **every one of the
fourteen rows** (`en.json:899-981`), and says so on purpose: an introductory note
states that no basis has been settled for any category and that each entry is the
team's reading of what is likely, not a decision (`en.json:890`). The page repeats it
for the purposes section (`en.json:990`) and lists it as the second open item
(`en.json:1096`). The team's guesses, for what they are worth, cluster into four
kinds: "the contract you asked for" (account, profile, activity, plans, connections);
"optional in the product" (photo, equipment, finance, push); "an obligation towards
children, with the guardian's consent standing in for the child's" (age and consent);
and "the operator's own interest in running the service" (technical logs). Two rows
say only "Not settled": the AI records, and the opponent records.

**What turns on it.** If any category lands on consent, the product needs a capture
and withdrawal mechanism it does not have — there is no consent record of any kind in
the schema except the guardian-consent columns, and no withdrawal path. If everything
lands on contract, the free-trial framing matters: the terms say there is no paid plan
and no price (`en.json:1123-1126`), so counsel will want to be satisfied that a
contract exists at all. If legitimate interests carries the technical logs, an
assessment has to be written, and none exists.

**The narrowest question, if time is short:** which basis covers a **coach's** record
of a **child's** training, given the coach is not the child's parent and the operator
is not a party to their coaching arrangement (`en.json:1051`, terms
`legal.terms.relationship`).

### 2. The processor list and the agreements each one needs

**Context.** The policy names seven recipients (`en.json:1025-1031`), and the code
confirms each: the hosting provider; a mail provider chosen by the operator, unnamed
and currently unconfigured; the browser's own push service; an AI provider, optional
and currently off; Open-Meteo for weather and elevation, receiving coordinates only;
Google Fonts, on every page load; and the OpenStreetMap Foundation's tile servers,
when the map is opened. The last two are requests the **browser** makes, not the
server — the policy notes they were missing from the list until somebody searched the
client for external URLs (`src/pages/legal/PrivacyPolicyPage.tsx:233-235`).

**What turns on it.** Whether each is a processor or an independent controller decides
what paperwork is needed and who must be named. Google Fonts and the tile servers are
the awkward ones: no data is *sent* to them by the operator, but a visitor's IP address
reaches them on every visit, before the visitor has done anything and whether or not
they are signed in (`en.json:1030`). If that requires a basis or a notice, note that
the typefaces are not load-bearing — the policy itself observes they could be served
from the same server as everything else — while the map tiles are the map.

**The consequence of "yes, agreements are needed":** the mail provider has not been
chosen yet, so one agreement is a decision rather than a signature; the hosting
agreement is the one that already exists and should be read; the AI providers need
nothing until one is switched on, and the policy says a provider must be named on the
page before that happens (`en.json:1046`).

### 3. Is "erasure by written request within a month" sufficient, given there is no self-service deletion?

**Context, verified.** The API has **14** delete endpoints. **None of them closes an
account**, and there is no `user.delete` call anywhere in the server or its demo seed
(citations in the table above; the security register records the same search,
`SECURITY.md:181-190`). So an erasure is carried out by hand: the database rows, and
separately the photograph file, which nothing else would clean up. The policy states
this rather than implying a button (`en.json:1077`), the terms repeat it
(`legal.terms.closure`), and it is the tenth open item (`en.json:1104`). Two facts
sharpen it: the nightly backups keep fourteen archives on the same disk, so anything
erased today persists in an archive for up to fourteen nights; and no process, log or
ticket system for handling such a request exists in the repository at all.

**What turns on it.** If a manual process is acceptable, it still has to be a process
— who receives the request, how the requester is identified, what is actually deleted,
what is retained and why, and how the fourteen-night backup window is explained. If it
is not acceptable, an account-closure path has to be built before launch, and the
security register already flags that the photograph file has nothing to hook a
"delete the file too" step onto.

**A related question the code raises and nobody has answered** (`en.json:1106`): must
a coach's private note about a player be disclosed when that player asks for their
data? The table for it exists and is deliberately isolated so a note could never
appear in a player's or parent's view, but nothing writes to it, so the question is
still theoretical — which makes now the cheap moment to answer it.

### 4. Photographs of minors, and who may see them

**Context.** One photograph per account, of the account holder, uploaded only by them.
The server re-encodes it, which strips the metadata — and for a child the coordinates
are the part that matters, because they would otherwise record where that child trains
(`en.json:995`). The file has no URL, its name is 32 random characters, and the web
server is deliberately unable to serve it. Every read is authorised on the server
before the file is even looked up, and a refusal is indistinguishable from "no
photograph exists".

**The finding counsel needs.** For a minor's photograph the code allows three
categories of reader: the player, an actively assigned or connected **coach**, and a
guardian **whose consent has been recorded in the guardianship table**. That third
branch reads a table **no production route ever writes** — it is filled only by the
synthetic demo data (`server/src/authz.ts:71-79`; writes only at
`server/prisma/seed.ts:436`). The policy discloses that those tables are demo-only
(`en.json:985`) but does not connect the two facts. So as the product stands, a real
parent cannot see their own child's photograph, and the guardian category in the
policy's photograph section describes an intention rather than a working permission.

**What turns on it.** If a parent is supposed to be able to see it, something has to be
built, and the basis for that access decided. If a coach's access is the operative
one, note what backs it: an active assignment (never created in production either) or
an **accepted connection where the actor's role is coach** — that is, a coach the child
or their parent accepted. Whether that acceptance is the child's consent, the parent's
consent, or neither, is the question. The terms already say the operator does not
employ, vet, supervise, endorse or certify any coach, checks nobody's qualifications
or insurance, and verifies nobody's right to work with children — and that whether it
ought to is unsettled and "a serious one" (`legal.terms.relationship`).

### 5. Opponent records — personal data about third parties who were never asked

**Context.** A coach or player can create a record about an opponent: a name, playing
tendencies, and free-text written observations (`schema.prisma:726`;
`server/src/opponents/routes.ts`). That person usually has no account here, has not
been told, and has not been asked. The policy calls this "the hardest entry on this
page: the person described has not been asked" (`en.json:962`), and keeps the record
for as long as the account that entered it exists. Opponents are frequently minors —
the product ships junior tournament calendars. The schema also reserves scouting-report
and game-plan tables built on those records; neither is written today.

**Two controls exist.** The terms restrict the content: keep it factual and about
tennis, and do not record an opponent's health, personal life, or your opinion of
their character (`legal.terms.use`, item 4). That is a rule addressed to the user, not
a constraint in the software — the observation field is free text and nothing
validates what goes into it. There is no notice to the opponent, no way for them to
find out a record exists, and no route by which they could object or ask for it.

**What turns on it.** Whether these records may be kept at all in their present form;
if so, on what basis, with what retention, and whether any notice is owed to the person
described. If notice is owed, note that the product holds no contact detail for them,
so there is no mechanism to give it. If it is not permitted, the feature has to change
before launch, and the two reserved tables should not be built.

### 6. A minor's account that can never be consented

**Context, verified.** When no mail transport is configured, a minor's signup creates
the account, marks it consent-required, and mints no token at all — the design
deliberately refuses the tempting shortcuts of returning the link in the response or
printing it to a log, because either would let anyone reading a log approve any child's
account (`server/src/auth/guardianConsentNoMail.routes.test.ts:1-17`). The generated
server configuration ships **every mail credential blank** and e-mail verification
switched off (`deploy/hetzner/setup.sh:64-79`). So on a default deployment, a child who
signs up leaves behind a permanent record — name, e-mail, date of birth, guardian's
name and e-mail — on an account that can never be activated and for which consent can
never be obtained. Separately, a consent link that *is* sent expires after 30 days and
is strictly single-use (`server/src/auth/routes.ts:415-417`).

**What turns on it.** What may be held, and for how long, on an account whose consent
was sought and never given — and on one where it was never sought because no mail
existed. If the answer is "nothing, or not for long", something has to delete them, and
nothing in the product deletes anything about a user.

### 7. The residual age question

**Context — and this differs from what the project's own notes say.** The threshold is
read from an environment variable, with a default of **16**
(`server/src/auth/guardianConsent.ts:26-27,49-50`), and the example configuration sets
16 (`server/.env.example:32`). **The Hetzner deployment passes no such variable to the
API container** (`deploy/hetzner/docker-compose.yml:36-77`) and the container's `.env`
file is excluded from its image (`server/.dockerignore:2-3`), so nothing can supply
one. The deployed API therefore enforces **16**, and an operator cannot change that
without editing the compose file — which makes the policy's phrase "16 unless the
operator changes it" (`en.json:1004`, and the same words in the terms at
`en.json:1132`) misleading for this deployment.

**So the residual question runs the opposite way to a stricter-elsewhere problem.**
Spain's age of digital consent is 14. This deployment treats a Spanish 14- or
15-year-old as needing a guardian's approval when the national rule would not require
it. The policy lists exactly this as its seventh open item (`en.json:1101`), and the
launch checklist records it too (`docs/LAUNCH-CHECKLIST.md:72`).

**What turns on it.** Three things. First, whether being *stricter* than the national
rule creates its own problem — the product collects a guardian's name and e-mail
address, from a child, for a consent the law did not require, and that guardian data is
kept for as long as the account exists (`en.json:909`). Second, what happens when the
service is used from a member state with a different age: the threshold is a single
number for the whole deployment, and nothing in the product knows or records where a
user is. Third, whether the phrase "unless the operator changes it" should be corrected
in both documents, or the deployment changed so that it becomes true. The policy's own
fourth open item asks how a guardian's authority is verified "per national age of
consent" (`en.json:1098`), which is the same question from the other end.

**One further fact for this question.** Guardian authority today is verified by nothing
more than holding the e-mail address the child typed in. Whoever opens the link is
presumed to be the guardian, not proven to be — the code says so and, for that reason,
returns only the child's first name and the account type rather than a user record
(`server/src/auth/routes.ts:445-452`). The policy flags this as open
(`en.json:1005`).

---

## 4. What is deliberately unresolved

Seven values in `src/lib/legal/companyDetails.ts` are `{{TOKEN}}` placeholders. They
are unresolved on purpose: the file records that the pages previously carried invented
specifics — a `privacy@` address nobody read, a `hello@` twin of it, and a "last
updated" line built from the current date so the document appeared to have been revised
every morning — and that all three read as facts while being none
(`companyDetails.ts:4-14`). They render as visibly marked placeholders, so a screenshot
of the page is self-documenting. **Nothing in this pack resolves any of them, and
counsel should not treat any value in it as a proposal.**

| Token | Line | What it is for |
|---|---|---|
| `{{COMPANY_NAME}}` | `companyDetails.ts:28` | The legal name **and legal form** of the entity behind the product — the controller named at the top of the privacy policy and the counterparty named in the terms |
| `{{COMPANY_ADDRESS}}` | `companyDetails.ts:31` | That entity's registered address, on both documents |
| `{{COMPANY_CONTACT_EMAIL}}` | `companyDetails.ts:34` | General contact for legal and account questions — and, per the terms, where an account-closure request is sent |
| `{{COMPANY_DPO_EMAIL}}` | `companyDetails.ts:37` | Where data-protection requests go: access, rectification, erasure. Until it exists, the policy states there is nowhere to send one (`en.json:1079`) |
| `{{COMPANY_JURISDICTION}}` | `companyDetails.ts:40` | Governing law and the courts with jurisdiction. The policy deliberately names **no** supervisory authority, deriving it from this field instead, because guessing would send a complaint to the wrong regulator (`PrivacyPolicyPage.tsx:308-310`) |
| `{{LEGAL_EFFECTIVE_DATE}}` | `companyDetails.ts:49` | The date the documents take effect. It must be written by hand on the day of adoption and must never return to a computed date — "an effective date that moves is not an effective date" |
| `{{COMPANY_DEMO_EMAIL}}` | `companyDetails.ts:52` | The mailbox behind the landing page's "book a demo" button. Until it is real, the button resolves to no mailbox and the page says so next to it |

**A counting discrepancy worth knowing:** the project's launch checklist says the file
holds "six placeholders" and lists name, address, contact e-mail, data-protection
e-mail, jurisdiction and effective date (`docs/LAUNCH-CHECKLIST.md:71`) — omitting the
demo e-mail. There are **seven** token constants in the file. Six of them are named
`COMPANY_*`; the seventh is the effective date. Whichever way they are grouped, all
seven are unfilled.

---

## 5. What has not been done

Stated so counsel is not the person who discovers it.

- **No external data-protection assessment of any kind.** No impact assessment, no
  record of processing activities, no legal review — the policy lists this as its
  eleventh open item (`en.json:1105`) and the security register says the same
  (`SECURITY.md:191-194`). There is also no retention schedule and no transfer
  mechanism for any recipient outside the EEA (`en.json:1042`, `en.json:1103`).
- **No penetration test and no independent security review.** Everything that was
  checked was checked by the people who wrote the code (`SECURITY.md:177-180`). The
  web app is served without a Content-Security-Policy header and the sign-in token is
  held in browser local storage rather than in a cookie the page cannot read, so a
  scripting flaw anywhere in the app would expose it (`en.json:1066`;
  `deploy/hetzner/Caddyfile:35-39`). A dependency audit on 5 September 2026 left two
  moderate advisories against the router library unfixed (`SECURITY.md`).
- **The Spanish text was written by an agent and has not been reviewed by a native
  speaker** (`docs/LAUNCH-CHECKLIST.md:60`). Both language versions of the policy and
  terms exist and are held in step by an automated test that fails the build if a key
  is missing on either side, so the *coverage* is complete — but the Spanish wording of
  every clause in section 2 is unreviewed. If either version is to be the operative
  one, counsel should say which, and the other should be treated as a translation
  rather than a parallel text.
- **The restore procedure for uploaded files is documented but not drilled.** The
  database half was rehearsed on 5 September 2026 against a throwaway container on the
  production host, in 1.1 seconds, with the results recorded step by step. The
  photograph half — the archive of the uploads directory that the same nightly script
  writes — has never been executed; the procedure is the exact inverse of the backup
  and is listed as an open item (`deploy/hetzner/RESTORE.md:17,20-22`;
  `SECURITY.md:172-175`). The live restore path on production, as opposed to into a
  throwaway container, has never been run at all
  (`docs/LAUNCH-CHECKLIST.md:63`).
- **No screen reader was driven and no real phone or tablet was used** — not a
  data-protection matter, but relevant if any accessibility statement is contemplated
  (`docs/LAUNCH-CHECKLIST.md:58-59`).

---

## 6. What this document could not establish

- **The data-centre location.** Not recorded anywhere in the repository. It has to come
  from the hosting account.
- **The live server's configuration.** Everything above describes the code and the
  deployment recipe at commit `edcb433`. Whether the running machine has an AI provider
  key, mail credentials, or a hand-edited compose file cannot be determined from the
  repository. Where a claim depends on that, the row says so.
- **Whether the fourteen-row table is exhaustive in the legal sense.** All 48 schema
  models were checked against it and every model holding personal data is accounted
  for, with the two thin spots named in 2.1. But "the product does not hold it" is a
  claim about behaviour, and this was a reading of the schema and the routes — not an
  inspection of a live database.
- **Anything about the nationality or corporate structure of the third parties named.**
  The code names Hetzner, Google, the OpenStreetMap Foundation, Open-Meteo, Anthropic
  and OpenAI. It says nothing about where any of them is established, and this document
  has not tried to fill that in.
- **Whether any of it is lawful.** That is the question being asked, not one this
  document answers.

---

*Assembled from the repository at commit `edcb433` on 8 September 2026 by an AI agent.
Not legal advice. Every claim is a starting point for verification.*
