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

No paid services, no runtime network dependencies. Fonts are self-hosted so
they render offline.

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

The standards are **bodyweight-ratio multipliers** (lift ÷ bodyweight) per big
lift, per biological sex, across five training levels: Untrained, Novice,
Intermediate, Advanced, Elite. The multiplier bands used here are consolidated
from widely published, openly documented strength-standard tables — primarily
**ExRx.net Strength Standards** (which are themselves derived from Lon Kilgore's
work) and cross-checked against the crowd-sourced **Symmetric Strength** /
**StrengthLevel** ratio bands. Values are stored in
`src/data/strengthStandards.ts` as a typed table with the source noted inline.

### Assumptions & Limitations (surfaced in-app)

1. **Ratio model, not a per-bodyweight regression.** We use a single lift/bodyweight
   ratio per level rather than an absolute table keyed to exact bodyweight.
   Ratio standards slightly overrate very light lifters and underrate very heavy
   lifters, because strength does not scale linearly with bodyweight (allometric
   scaling). We state this in the comparison UI.
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

## 8. Verification Results (Definition of Done)

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
