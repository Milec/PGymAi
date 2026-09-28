import { useEffect, useState } from 'react';

/**
 * Re-render every `intervalMs` (default 1s) and on tab-visibility resume.
 *
 * The interval is torn down while the tab is hidden: nothing is on screen to
 * update, and a phone in a pocket mid-workout shouldn't be woken every second.
 * Because the clock is read fresh on resume, a paused ticker can't drift —
 * every consumer derives from timestamps, not from counting ticks.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (id === undefined) id = setInterval(() => setNow(Date.now()), intervalMs);
    };
    const stop = () => {
      if (id !== undefined) clearInterval(id);
      id = undefined;
    };
    const sync = () => {
      setNow(Date.now());
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [intervalMs]);

  return now;
}
