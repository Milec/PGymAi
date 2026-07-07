import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'stride.chunkReloaded';

/**
 * `React.lazy` that survives stale dynamic-import chunks.
 *
 * With an auto-updating service worker, a new deploy replaces the hashed chunk
 * files while the already-open page still references the old names. Navigating
 * to a lazily-loaded route (e.g. the Profile/"You" tab) then requests a chunk
 * that no longer exists — the import rejects and, with no error boundary, the
 * whole route renders blank until the user closes and reopens the app.
 *
 * On the first such failure we hard-reload once to fetch the fresh app shell —
 * exactly what closing and reopening does — guarding against reload loops with a
 * one-shot sessionStorage flag that clears as soon as any chunk loads cleanly.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      window.sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      if (!window.sessionStorage.getItem(RELOAD_KEY)) {
        window.sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // Keep Suspense pending while the page reloads with the fresh shell.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
