---
name: verify
description: Build, launch, and drive STRIDE (Vite PWA) to verify changes at the browser surface with Playwright + the preinstalled Chromium.
---

# Verifying STRIDE changes

## Build & launch

```bash
pnpm install --frozen-lockfile
pnpm build                       # tsc -b && vite build → dist/
pnpm preview --port 4173 &       # serves dist/
```

Dev server (`pnpm dev`, port 5173) also works when you need un-minified errors.

## Drive with Playwright

- Routing is **HashRouter**: pages live at `http://localhost:4173/#/fuel`,
  `#/workout`, etc. A bare `/fuel` silently renders the Dashboard.
- Launch Chromium via `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`.
- Scripts importing `@playwright/test` must live inside the repo (Node ESM
  resolves packages from the script's own path, not cwd). Copy from the
  scratchpad, run, delete.
- Useful entry points: Fuel page add-food buttons are
  `getByLabel(/Add food to/i)`; the food search input is
  `getByLabel('Search foods')` (600 ms debounce, 3+ chars).

## Gotchas

- **Remote sandbox**: the egress proxy resets browser CONNECTs, so the app's
  live calls to openfoodfacts.org / api.nal.usda.gov fail inside Chromium
  even though curl works. Bridge with `page.route`: fulfill the request with
  the body from `curl <same-url>` (real live data), or `route.abort()` to
  simulate an outage.
- Open Food Facts 503s requests without a browser-like User-Agent — curl
  probes need `-H "User-Agent: STRIDE/1.0"`.
- USDA `DEMO_KEY` has a tiny quota (~30 req/hr/IP); don't loop probes on it.
- App state (profile, foods) is Dexie/IndexedDB per browser context — a fresh
  context is a fresh install; no login or seed step needed.
