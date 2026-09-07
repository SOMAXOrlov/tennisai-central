# Image attribution

Every image this repository ships, what it is, where it came from, and under
what licence. Where the origin cannot be established from the history, the
metadata or any note in the repo, this file says **unknown** — that is the
honest entry, and it is the reason the file exists.

Written 2026-09-07. Keep it current: **adding an image means adding a row
here.** An image with no row is an image nobody can license, and the first
person who needs to answer "can we ship this?" will have to reconstruct what
was known today from a git log.

No licence is guessed anywhere below. "Unknown" means unknown, not "probably
fine".

---

## Ours — made for this project

| File(s) | What it is | Origin | Licence |
|---|---|---|---|
| `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` | The app's brand mark: a drawn tennis ball — an off-white disc with two seam curves — on the forest-green `--primary`. Used as the browser icon, the web-app-manifest icons and the iOS home-screen icon. | Drawn for this app in commit `dd74cc0` (2026-09-04), to replace the scaffolding tool's logo, which was still the implicit favicon. Geometric vector artwork; no photographic source. | This project's own work. The repository ships no `LICENSE` file, so these are covered by whatever licence the repository is eventually released under. |
| `public/og-image.png` | 1200×630 link-share card (`og:image` / `twitter:image`, `index.html:17,24`). | Generated in commit `a653a70` (2026-09-04) from `public/icon-512.png` on `--primary`; the commit message records that. | As above. |
| `public/landing/conditions-prep.png`, `public/landing/feeds-provenance.png`, `public/landing/guardian-consent.png` | Three screenshots of this app running, used as the landing page's feature illustrations (`src/pages/Index.tsx:29-31`). | Captured from the running app for commit `d4ceeda` (2026-09-06). They show synthetic demo data only — no real person's data, and no child's data. | As above. |
| `src/components/courts/CourtSurfaceArt.tsx` | Not an image file, but it is what the court tiles in `SurfacePicker` are made of: the clay / grass / hard / indoor surfaces drawn as inline SVG. Listed here because it is the material that replaced the three court photographs described at the bottom of this file. | Written in this repository. Hues come from `SURFACE_COLOR` in `src/lib/calendar/colors.ts`; nothing is traced, sampled or derived from a photograph. | As above. |

## Unknown origin — inherited, licence not established

| File(s) | What it is | Origin | Licence |
|---|---|---|---|
| `src/assets/tennis-ball.png`, `.webp`, `.avif` and the `-128` / `-256` variants (9 files, ~703 KB) | A photographic — or photorealistic-rendered — yellow tennis ball on a transparent background, at three sizes in three formats. | **Unknown.** Added 2026-05-15 in commits `03bdd3e`, `50b014f` and `03ed7f0`, all three titled just "Changes", from the original project scaffold. Nothing in the repo says where the image came from; the files carry no `tEXt`/`iTXt`/EXIF metadata. The smaller sizes and the `.webp` / `.avif` copies are plainly derived from the same original — derivation says nothing about the original's licence. | **Unknown.** No licence is recorded anywhere in the repo, and none is asserted here. Treat as not cleared for use. |
| `public/favicon.ico` | 256×256 icon. It is the **scaffolding tool's logo, not ours** — `index.html:31-36` says so and overrides it with `/icon-192.png`. Still shipped, because a browser asks for `/favicon.ico` regardless and `public/sw.js:29` precaches it. | The Vite + shadcn scaffold template, commit `b331aa1` (`template: new_style_vite_react_shadcn_ts_testing_2026-01-08`). | **Unknown.** Whatever terms the scaffold template ships under were never recorded here, so they are not asserted here. |
| `public/placeholder.svg` | The scaffold's generic grey 1200×1200 placeholder graphic (a camera glyph). Vector, no photographic content. **Referenced by nothing** in `src/**`, `public/**` or `index.html`. | Same scaffold template commit `b331aa1`. | **Unknown**, as above. |

### Two notes that follow from the table

- The nine `tennis-ball*` files are **referenced by nothing** in `src/**` — no
  import, no `import.meta.glob`, no string. They are ~703 KB of
  unknown-provenance imagery sitting in the tree without being shipped to a
  browser by any code path. Deleting them would remove the liability outright;
  that is a separate decision from this change and is deliberately left to the
  owner.
- The app's own brand mark (`icon-*.png`, and therefore `og-image.png`) is
  **not** derived from `tennis-ball.png`. It is flat geometric artwork drawn in
  `dd74cc0`; the photographic ball is a different image entirely. So the
  unknown provenance above does not propagate into the icons.

## Third-party imagery loaded at runtime — not shipped in this repo

Recorded for completeness; none of it is a file in this tree.

| What | Where | Attribution / licence |
|---|---|---|
| OpenStreetMap map tiles | `src/components/tournaments/TournamentMap.tsx:224` | Attributed in the UI as OpenStreetMap requires — `TournamentMap.tsx:225` renders "© OpenStreetMap contributors" with a link to `openstreetmap.org/copyright`. |
| DM Sans, Inter and Space Grotesk webfonts | `@import` at `src/index.css:3` | Served by Google Fonts. Each family's licence is the one Google Fonts states for it; no licence is asserted here, and no font file is committed to this repo. |

---

## Removed: the three court-surface photographs

`src/assets/surface-clay.jpg`, `surface-grass.jpg` and `surface-hard.jpg`
(418,111 bytes together) were deleted in the change that added this file.

They arrived 2026-05-15 in the same generic "Changes" commits as the tennis
ball, with **no licence and no attribution anywhere in the repo**, and no
metadata in the files. Their provenance was unknown, which made three
photographs of unknown origin part of a product that already refuses to scrape
retailer imagery for the gear catalogue (`EquipmentProduct.imageUrl` — see
`server/prisma/seedGear.ts`). They were also incomplete: only three of the four
surfaces the picker offers had a photo, so `indoor` never matched its
neighbours.

They were replaced by drawn art (`src/components/courts/CourtSurfaceArt.tsx`),
which covers all four surfaces and is ours. Nothing was copied from another
site to do it.

The `<img>` path in `src/components/SurfaceImage.tsx` is untouched and still
live: a real, licensed club photograph can be imported and set as `src` in
`src/components/SurfacePicker.tsx` at any time, and it will render — with a row
added here.
