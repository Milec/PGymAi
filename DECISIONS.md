# STRIDE — Engineering Decisions & Design Log

STRIDE is an offline-first PWA for tracking workouts and strength progression,
with a "Starship HUD" aesthetic. This file records stack choices, the
strength-standards data source and its assumptions, and schema documentation.

## 1. Stack (decisive)

| Concern | Choice | Rationale |
| --- | --- | --- |
| Framework | React 19 + TypeScript (strict) + Vite 8 | Fast HMR, first-class TS, ecosystem. |
| Styling | Tailwind CSS v4 + CSS variable design tokens | Utility speed + a small themable token layer for the HUD look. |
| PWA | vite-plugin-pwa (Workbox) | Manifest, service worker, offline app-shell + runtime caching, installability. |
| Persistence | Dexie (IndexedDB) | Local-first, no backend, structured queries, large storage. |
| State | Zustand | Minimal boilerplate global store; plays well with Dexie live queries. |
| Charts | Recharts | Declarative, responsive, good enough for the required charts. |
| Validation | Zod | Runtime validation of imported program JSON. |
| Tests | Vitest (unit) + Playwright (smoke + screenshots) | Unit math/logic + real-browser verification loop. |

No paid services. The only runtime network dependency is the optional Open
Food Facts food-catalogue lookup on the Fuel page (§12) — everything else,
including fonts, is self-hosted and works offline.

## 2. Fonts (self-hosted, offline-safe)

- **Orbitron** — wide uppercase headings/labels.
- **IBM Plex Mono** — all numeric readouts (weights, reps, timers), tabular figures.
- **Space Grotesk** — body text.

Fonts are downloaded at build-setup time into `public/fonts/` and referenced
with `@font-face` + `font-display: swap` so they are cached by the service
worker and available offline.

## 3. Strength-Standards Data Source & Assumptions

**This is the most important honesty section.** The bodyweight-relative
comparison must not fabricate numbers.

### Source

**Updated (v5): the comparison now uses the Wilks score.** Each lift is
normalised with the published **Wilks-1 coefficient** (a function of bodyweight
and sex; `src/lib/wilks.ts`), giving `Wilks = coefficient × e1RM`. This replaces
the raw lift/bodyweight ratio as the headline metric, so athletes of different
bodyweights/sexes are on one comparable scale.

The five **level bands** (Untrained → Elite) are expressed as Wilks scores,
**derived** by running the previously-used ratio standards — consolidated from
**ExRx.net Strength Standards** (Lon Kilgore) cross-checked against
**Symmetric Strength** / **StrengthLevel** — through the Wilks formula at
reference bodyweights (male 90 kg, female 65 kg) and averaging the sexes. So the
bands are grounded in published tables, not invented. Both the ratio table
(`STRENGTH_STANDARDS`) and the derived `WILKS_BANDS` live in
`src/data/strengthStandards.ts`.

### Assumptions & Limitations (surfaced in-app)

1. **Derived bands.** The Wilks coefficient itself is the standard published
   formula, but the per-lift level thresholds are derived from ratio standards
   (see above), so they are approximate references rather than official Wilks
   benchmarks (Wilks is normally applied to a 3-lift total, not single lifts).
   The Wilks-1 polynomial is only valid within its fitted bodyweight range, so
   the coefficient is clamped (male ≤ 200 kg, female ≤ 150 kg).
2. **"Average person of your bodyweight"** is defined explicitly as the
   **Novice** band ceiling — i.e., roughly what a healthy, minimally-trained
   adult of that sex/bodyweight can lift. This is a *reference point*, not a
   census of the general population (most of whom do not train these lifts at
   all). The app says this plainly.
3. **Percentile** shown is an **approximate** mapping from the level bands to a
   trained-lifter distribution; it is labelled "approx." and is not a
   statistically rigorous population percentile.
4. Standards are defined for the main barbell lifts (Back Squat, Bench Press,
   Deadlift, Overhead Press, Barbell Row, Front Squat). Other exercises show
   progression charts but no standards comparison.
5. Sex is used strictly as a biological input to the standards (male/female
   bands). Users can set "unspecified" and standards comparison is hidden.

The numbers are presented as **approximate reference bands**, never as
authoritative medical or competitive standards.

## 4. Program Import Schema (Zod-validated)

See `src/schema/program.ts` for the authoritative schema. Summary:

```jsonc
{
  "schemaVersion": 1,
  "name": "Novice Linear Progression",
  "author": "STRIDE",
  "description": "…",
  "units": "kg",                 // kg | lb — how absolute loads are expressed
  "weeks": [
    {
      "name": "Week 1",
      "days": [
        {
          "name": "Day A",
          "exercises": [
            {
              "exerciseName": "Back Squat",   // matched to library by name
              "sets": 3,
              "reps": 5,                        // number or [min,max] for ranges
              "intensity": {                    // one of the intensity forms
                "type": "rpe",                  // rpe | percent1rm | absolute
                "value": 8
              },
              "progression": {                  // optional adaptive rule
                "type": "linear",               // linear | double | percent-e1rm
                "incrementKg": 2.5,
                "onSuccessRepTarget": 5
              },
              "notes": "Last set AMRAP"
            }
          ]
        }
      ]
    }
  ]
}
```

Intensity forms:
- `absolute` — a fixed load in the program's `units`.
- `percent1rm` — percentage of the user's estimated 1RM for that lift.
- `rpe` — target Rate of Perceived Exertion (auto-regulated load).

Progression rules (LiftOff-style auto-regulation):
- `linear` — add a fixed increment each session on success.
- `double` — double progression: climb the rep range, then add load and reset.
- `percent-e1rm` — next load = X% of the latest estimated 1RM.

## 5. e1RM Formulas

Two formulas are computed and both shown, with the active one labelled:
- **Epley**: `1RM = w × (1 + reps/30)`
- **Brzycki**: `1RM = w × 36 / (37 − reps)`

Epley is the default display; Brzycki is shown as a cross-check. Reps above ~12
degrade accuracy and the UI notes this.

## 6. Decisions Log (chronological)

- **Init**: Chose the stack above; committed plan before building.
- Tailwind v4 CSS-first config (`@theme`, `@import "tailwindcss"`); design tokens
  as CSS variables in `src/styles/tokens.css`.
- Screenshot verification via Playwright/Chromium into `artifacts/screenshots/`.
- **Fonts**: Orbitron and Space Grotesk are variable fonts on Google Fonts, so
  the latin-subset `.woff2` is a single shared file per family (identical bytes
  across weights) — self-hosted, precached by Workbox for offline use.
- **HudPanel**: the chamfer `clip-path` is applied to an inner absolutely-
  positioned glass layer so edge labels and corner brackets are never clipped.
- **Routing**: `HashRouter` (no server rewrites needed offline) + route-level
  `React.lazy` code-splitting; Recharts is isolated in its own chunk.
- **Seeding**: `ensureSeeded` is guarded by an in-flight promise and uses
  `bulkPut` so React StrictMode's double-invoke can't race the first seed.
- **Timers**: rest + duration timers store absolute timestamps (localStorage /
  the workout record) and recompute on resume, surviving backgrounding/reload.

## 7. Cloud Sync (Supabase) & Deployment

**Added after v1** to give STRIDE optional accounts + multi-device sync without
sacrificing the offline-first design.

### Sync architecture — local-first with background sync

- **IndexedDB stays the source of truth.** The Supabase client (`src/lib/supabase.ts`)
  is `null` when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset, so the
  app behaves exactly as the local-only v1 until configured. All sync calls
  null-check and no-op otherwise.
- **Backend shape**: each record is a JSONB `data` blob + an `updated_at`
  epoch-ms bigint (`supabase/schema.sql`). Tables: `profiles`, `workouts`,
  `programs`, `custom_exercises`, plus a `deletions` tombstone table.
- **Conflict resolution**: **last-write-wins** by `updatedAt`. The pure
  `reconcile()` in `src/sync/merge.ts` computes, for a local + remote record set
  (with tombstones on both sides), what to write locally, delete locally, push,
  and delete remotely. It is unit-tested in isolation (`merge.test.ts`).
- **Deletions** propagate via tombstones (local Dexie `deletions` table ↔ remote
  `deletions` table) so a delete on one device removes the record everywhere,
  even across offline windows.
- **Realtime**: `postgres_changes` subscriptions apply inbound edits/deletes from
  other devices live. Store writes push optimistically (debounced ~1.5s so
  typing a set doesn't spam the network); a full `reconcile` runs on sign-in and
  on reconnect (`online` event).
- **Security**: Row Level Security scopes every row to `auth.uid()`.
- **Auth**: email/password + magic-link (`signInWithOtp`). OAuth is intentionally
  deferred (needs per-provider dashboard config).
- **Limitations** (documented in-app + README): LWW is record-level, not
  field-level; the seeded exercise library isn't synced (identical everywhere),
  only custom exercises are.

**Why LWW + JSONB blobs** rather than a normalized relational schema: it mirrors
the existing Dexie record model 1:1, keeps the sync engine small and generic,
and avoids schema drift between the two stores. For a single-user-per-account
fitness log this is sufficient and robust.

### Deployment — GitHub Pages

- `.github/workflows/deploy.yml` builds with pnpm and publishes `dist/` via
  `actions/deploy-pages`. Triggers on push to `main` + manual dispatch.
- Pages serves under `/<repo>/`, so the workflow sets `VITE_BASE=/<repo>/`;
  `vite.config.ts` applies it to `base`, the PWA manifest `scope`/`start_url`,
  and `navigateFallback`. Hash-based routing means deep links work without
  server rewrites. `public/.nojekyll` prevents Jekyll from touching assets.
- Supabase creds are read from repo **secrets** at build time (public anon key,
  but kept out of git per guardrails); absent secrets → the deployed site runs
  local-only.

## 8. Themes, chart periods, and per-lift PRs (v3)

- **Themes**: design tokens are CSS variables, so theming is a variable-override
  layer (`src/styles/themes.css`) keyed on `:root[data-theme=…]`. Ships four
  themes — Starship HUD (default), Dark Night, Light, Bubblegum. The aurora,
  dotted grid, scanlines, and chart colours read tokens too, so the whole app
  re-skins. The choice persists in the profile (and syncs). `applyTheme()` also
  keeps the PWA `theme-color` meta in step with the background.
- **Chart periods**: the dashboard volume chart takes a week window (4/8/12/26/52);
  the Progress charts take a 3M/6M/1Y/All filter applied to the point series.
- **Per-lift PRs + auto-fill**: a user's manual 1RM per exercise is stored on the
  profile (`profile.prs[exerciseId]`, kg) — so it syncs with no new backend
  table. The Library lets you set/clear it per lift. In a workout, "Auto-fill
  weight" computes working load from the effective 1RM (manual PR, else best
  historical e1RM) by **%1RM**, or by **RPE + reps** via the RPE→%1RM table
  (`rpePercent`), rounded to plate increments, and fills every set (RPE mode also
  prefills reps).
- **Scroll lock**: `overscroll-behavior: none` on `html`/`body` plus a fixed
  background stops rubber-band scrolling above the top banner.

## 9. Training Log & Calendar (v4)

- New `/history` route ("Training Log", nav short label "Log", 8th tab — the
  mobile bottom bar still fits at 390px with the short labels).
- **Calendar**: a Monday-first month grid built from finished workouts' dates;
  trained days are highlighted (cyan), today is ringed (amber), multi-session
  days show a count. Month is navigable; tapping a trained day filters the list.
- **Session log**: all finished sessions, newest first, each with a summary
  (duration, volume, sets, lifts). Expanding a card shows every exercise with
  its completed sets (weight × reps, RPE) and per-exercise e1RM. Sessions can be
  deleted (routed through `removeWorkout`, so the deletion tombstone syncs).
- Read-only over existing data — no schema change; reuses `useFinishedWorkouts`.

## 10. Logging & standards refinements (v5)

- **Wilks strength standards** — see §3 (reworked from ratio bands to Wilks
  score); the in-app disclaimer was shortened.
- **Bodyweight sets** — a set now counts as logged/complete with reps only
  (weight optional), so exercises like Ab Wheel Rollout or Push-Ups record
  properly. Volume is `weight × reps` (0 for bodyweight); the log shows "BW".
  The logged-set predicate changed from `reps > 0 && weight > 0` to `reps > 0`.
- **Per-set weight ↔ %** — when a lift has a 1RM, the set logger adds a `%`
  column; entering either weight or % fills the other, rounded to plate
  increments (2.5 kg / 5 lb). The bulk "Auto-fill" panel remains for filling all
  sets by %1RM or RPE.
- **Muscle balance** now shares the dashboard volume chart's period selector.
- **Sign-in CTA** made solid/opaque (was a faint translucent fill); the
  decorative aurora layer is `pointer-events-none` so it can never intercept a
  tap.

## 11. Verification Results (Definition of Done)

Verified locally against the production build (`pnpm preview`):

- `pnpm build` — succeeds, TypeScript strict, **0 type errors**.
- `pnpm lint` — ESLint **clean** (`--max-warnings=0`).
- `pnpm test` — **48 Vitest unit tests pass** (e1RM, progression, standards,
  import validation, analytics, units).
- `pnpm e2e` — **6 Playwright smoke tests pass** (boot, all routes, library
  search, full logging flow, import validation, program follow).
- **Lighthouse** (Chromium, production preview): Performance **93**,
  Accessibility **100**, Best-Practices **100**.
- **PWA**: valid manifest (standalone, maskable icon, theme/bg `#05070f`),
  service worker registers and activates, and the app + IndexedDB data remain
  **fully usable offline** (verified by reloading with the network disabled).
- Screenshots of every screen at 390×844 and 1440×900 in
  `artifacts/screenshots/`.

## 12. Fuel — nutrition journal & macro tracking (v6)

A MyFitnessPal-style dieting side of the app, kept deliberately lean.

### Navigation — expandable side menu

Eight flat tabs couldn't absorb a ninth destination, so navigation became a
grouped, expandable side menu shared by desktop and mobile:

- **Desktop rail**: Dashboard and Profile stay top-level; **TRAINING**
  (Workout, Library, Progress, Strength, Programs, Log) and **NUTRITION**
  (Fuel) are collapsible groups. Collapse state persists in localStorage
  (`stride.nav.collapsed`); the group holding the active route is forced open
  so the current page can never be hidden.
- **Mobile**: the bottom bar is trimmed to the four thumb-reach destinations
  (Deck, Lift, Fuel, Log) + a **Menu** tab that opens a slide-in drawer with
  the full grouped nav. Less clutter than the previous 8-tab bar.

### Food catalogue — Open Food Facts

Search and barcode lookup use the **Open Food Facts** public API
(world.openfoodfacts.org — free, ODbL-licensed, CORS-enabled, millions of
products; the only runtime network dependency in the app, and an optional
one). `src/lib/foodApi.ts` normalises products to per-100g macros
(`energy-kcal_100g`, kJ fallback ÷ 4.184) and keeps gram/ml serving sizes;
products without usable energy data are dropped rather than logged as
0 kcal. Failures surface as explicit offline/error states — saved foods and
custom foods still work with no network.

### Barcode scanning

`BarcodeScanner` uses the native **BarcodeDetector** API where available
(Chrome/Edge/Android). Elsewhere (iOS Safari, Firefox) it lazy-loads a
**ZXing** WASM-free decoder (`@zxing/browser`) — kept out of the main bundle
via dynamic import. Manual barcode entry is always available (and is the
path exercised in tests, since headless CI has no camera).

### Targets — published formulas only

- **BMR**: Mifflin-St Jeor (male +5 / female −161; 'unspecified' uses the
  midpoint, −78). Requires weight, height, age — height was added to the
  profile (`heightCm`).
- **TDEE**: standard activity multipliers (1.2 / 1.375 / 1.55 / 1.725 / 1.9),
  chosen by training frequency.
- **Goal calories**: TDEE ± `rate × 7700 kcal / 7` for cut/bulk at
  0.25–0.75 kg/week, floored at 1200 kcal/day.
- **Macros**: protein by g/kg bodyweight (1.6/1.8/2.2), fat as % of calories
  (25/30/35), carbs from the remainder at 4/9/4 kcal per gram.
- A **manual mode** lets users type their own targets; `nutrition.auto`
  records which mode produced them. In-app copy labels everything as a
  planning estimate, not medical advice. All math is in `src/lib/nutrition.ts`
  and unit-tested.

### Journal storage

Dexie v3 adds two local tables:

- `foodLogs` — one row per logged food: local-date key (`YYYY-MM-DD`), meal
  (breakfast/lunch/dinner/snacks), **snapshotted per-100g macros** (entries
  stay stable if the catalogue changes), amount in grams (canonical),
  optional serving size and barcode.
- `foods` — reusable foods ("My Foods"): custom creations plus a cache of
  everything logged from the catalogue (keyed by barcode so re-logs update
  one row), surfaced for one-tap re-logging and offline use.

Targets and calculator inputs live on the profile (`profile.nutrition`), so
they **sync via the existing profile blob with no backend change**. The
journal itself is cloud-backed too: `food_logs` and `foods` are registered
sync entities (same JSONB + last-write-wins + tombstone model as workouts;
tables, RLS, and Realtime in `supabase/schema.sql`, which also widens the
tombstone entity check in place for pre-Fuel installs). Journal writes go
through the debounced sync helpers, so rapid edits don't spam the network,
and everything remains fully usable signed-out/offline.

### Quantity model (MyFitnessPal-style)

A log amount is **number of servings × serving size**. The serving-size
options are the product's labelled serving (when the catalogue declares
one), 100 g, 1 g (for exact gram entry), and 1 oz. Storage stays canonical
in grams (`amountG`), so switching units never mutates history; the picker
merely re-derives the servings count when the unit changes.
