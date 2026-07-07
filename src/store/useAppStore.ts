import { create } from 'zustand';
import { db } from '@/db/db';
import { DEFAULT_PROFILE, ensureSeeded } from '@/db/seed';
import type { LoggedSet, Profile, Workout, WorkoutEntry } from '@/db/types';
import { estimate1rm } from '@/lib/e1rm';
import { uid } from '@/lib/id';
import { applyTheme, DEFAULT_THEME, type ThemeName } from '@/lib/theme';
import { persistProfile, persistWorkout, removeWorkout } from '@/sync/local';

const REST_KEY = 'stride.restEndsAt';

interface AppState {
  ready: boolean;
  profile: Profile;
  active: Workout | null;
  restEndsAt: number | null;
  restDurationSec: number;

  init: () => Promise<void>;
  reloadFromDb: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  setTheme: (theme: ThemeName) => Promise<void>;
  setPr: (exerciseId: string, oneRmKg: number | null) => Promise<void>;

  startWorkout: (opts?: Partial<Pick<Workout, 'title' | 'programId' | 'weekIndex' | 'dayIndex'>>) => Promise<void>;
  startSession: (w: Workout) => boolean;
  loadActive: (w: Workout) => void;
  addEntry: (exerciseId: string) => void;
  removeEntry: (entryId: string) => void;
  addSet: (entryId: string, set?: Partial<LoggedSet>) => void;
  updateSet: (entryId: string, setId: string, patch: Partial<LoggedSet>) => void;
  removeSet: (entryId: string, setId: string) => void;
  toggleComplete: (entryId: string, setId: string) => void;
  setEntryNotes: (entryId: string, notes: string) => void;
  finishWorkout: () => Promise<string | null>;
  discardWorkout: () => Promise<void>;

  startRest: (sec?: number) => void;
  clearRest: () => void;
  addRest: (delta: number) => void;
}

function persistActive(w: Workout | null) {
  if (w) void persistWorkout(w);
}

/**
 * For each exercise in a finished workout that has no 1RM PR yet, derive one
 * from the best estimated 1RM across that exercise's logged sets. Returns the
 * PRs to add (keyed by exercise id); never overwrites an existing PR.
 */
export function newPrsFromWorkout(
  workout: Workout,
  existing: Record<string, number> | undefined,
): Record<string, number> {
  const added: Record<string, number> = {};
  for (const entry of workout.entries) {
    if (existing?.[entry.exerciseId] != null) continue; // already has a PR
    let best = added[entry.exerciseId] ?? 0;
    for (const s of entry.sets) {
      if (s.reps > 0 && s.weightKg > 0) {
        best = Math.max(best, estimate1rm(s.weightKg, s.reps));
      }
    }
    if (best > 0) added[entry.exerciseId] = best;
  }
  return added;
}

function newSet(partial?: Partial<LoggedSet>): LoggedSet {
  return {
    id: uid('set'),
    weightKg: 0,
    reps: 0,
    completed: false,
    ...partial,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  profile: DEFAULT_PROFILE,
  active: null,
  restEndsAt: null,
  restDurationSec: 0,

  init: async () => {
    await ensureSeeded();
    const profile = (await db.profile.get('me')) ?? DEFAULT_PROFILE;
    const unfinished = await db.workouts
      .filter((w) => w.finishedAt === undefined)
      .reverse()
      .sortBy('startedAt');
    const active = unfinished[0] ?? null;
    const restRaw = localStorage.getItem(REST_KEY);
    const restEndsAt = restRaw ? Number(restRaw) : null;
    applyTheme(profile.theme ?? DEFAULT_THEME);
    set({
      ready: true,
      profile,
      active,
      restEndsAt: restEndsAt && restEndsAt > Date.now() ? restEndsAt : null,
    });
  },

  updateProfile: async (patch) => {
    const profile = { ...get().profile, ...patch };
    set({ profile });
    await persistProfile(profile);
  },

  setTheme: async (theme) => {
    applyTheme(theme);
    await get().updateProfile({ theme });
  },

  setPr: async (exerciseId, oneRmKg) => {
    const prs = { ...(get().profile.prs ?? {}) };
    if (oneRmKg && oneRmKg > 0) prs[exerciseId] = oneRmKg;
    else delete prs[exerciseId];
    await get().updateProfile({ prs });
  },

  reloadFromDb: async () => {
    const profile = (await db.profile.get('me')) ?? DEFAULT_PROFILE;
    const a = get().active;
    // Refresh the active session from the DB only if it still exists unfinished.
    let active = a;
    if (a) {
      const fresh = await db.workouts.get(a.id);
      active = fresh && fresh.finishedAt === undefined ? fresh : a;
    }
    applyTheme(profile.theme ?? DEFAULT_THEME);
    set({ profile, active });
  },

  startWorkout: async (opts) => {
    const existing = get().active;
    if (existing) return; // one at a time
    const w: Workout = {
      id: uid('wk'),
      startedAt: Date.now(),
      title: opts?.title ?? 'Freestyle Session',
      entries: [],
      programId: opts?.programId,
      weekIndex: opts?.weekIndex,
      dayIndex: opts?.dayIndex,
      bodyweightKgAtTime: get().profile.bodyweightKg,
    };
    set({ active: w });
    persistActive(w);
  },

  startSession: (w) => {
    if (get().active) return false;
    set({ active: w });
    persistActive(w);
    return true;
  },

  loadActive: (w) => {
    set({ active: w });
    persistActive(w);
  },

  addEntry: (exerciseId) => {
    const a = get().active;
    if (!a) return;
    const entry: WorkoutEntry = { id: uid('en'), exerciseId, sets: [newSet()] };
    const active = { ...a, entries: [...a.entries, entry] };
    set({ active });
    persistActive(active);
  },

  removeEntry: (entryId) => {
    const a = get().active;
    if (!a) return;
    const active = { ...a, entries: a.entries.filter((e) => e.id !== entryId) };
    set({ active });
    persistActive(active);
  },

  addSet: (entryId, s) => {
    const a = get().active;
    if (!a) return;
    const active = {
      ...a,
      entries: a.entries.map((e) => {
        if (e.id !== entryId) return e;
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [...e.sets, newSet({ weightKg: last?.weightKg ?? 0, reps: last?.reps ?? 0, ...s })],
        };
      }),
    };
    set({ active });
    persistActive(active);
  },

  updateSet: (entryId, setId, patch) => {
    const a = get().active;
    if (!a) return;
    const active = {
      ...a,
      entries: a.entries.map((e) =>
        e.id === entryId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
          : e,
      ),
    };
    set({ active });
    persistActive(active);
  },

  removeSet: (entryId, setId) => {
    const a = get().active;
    if (!a) return;
    const active = {
      ...a,
      entries: a.entries.map((e) =>
        e.id === entryId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
      ),
    };
    set({ active });
    persistActive(active);
  },

  toggleComplete: (entryId, setId) => {
    const a = get().active;
    if (!a) return;
    let nowCompleted = false;
    const active = {
      ...a,
      entries: a.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((s) => {
                if (s.id !== setId) return s;
                nowCompleted = !s.completed;
                return { ...s, completed: !s.completed };
              }),
            }
          : e,
      ),
    };
    set({ active });
    persistActive(active);
    if (nowCompleted) get().startRest();
  },

  setEntryNotes: (entryId, notes) => {
    const a = get().active;
    if (!a) return;
    const active = {
      ...a,
      entries: a.entries.map((e) => (e.id === entryId ? { ...e, notes } : e)),
    };
    set({ active });
    persistActive(active);
  },

  finishWorkout: async () => {
    const a = get().active;
    if (!a) return null;
    // Drop empty entries / incomplete-but-empty sets.
    const entries = a.entries
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.reps > 0 || s.weightKg > 0) }))
      .filter((e) => e.sets.length > 0);
    const finished: Workout = { ...a, entries, finishedAt: Date.now() };
    await persistWorkout(finished, true);

    // Auto-log a 1RM PR for any exercise done this session that has none yet,
    // deriving it from the best estimated 1RM across the sets they just did.
    const profile = get().profile;
    const additions = newPrsFromWorkout(finished, profile.prs);
    if (Object.keys(additions).length > 0) {
      const prs = { ...(profile.prs ?? {}), ...additions };
      const updated = { ...profile, prs };
      set({ profile: updated });
      await persistProfile(updated);
    }

    set({ active: null, restEndsAt: null });
    localStorage.removeItem(REST_KEY);
    return finished.id;
  },

  discardWorkout: async () => {
    const a = get().active;
    if (!a) return;
    await removeWorkout(a.id);
    set({ active: null, restEndsAt: null });
    localStorage.removeItem(REST_KEY);
  },

  startRest: (sec) => {
    const dur = sec ?? get().profile.restDefaultSec;
    const endsAt = Date.now() + dur * 1000;
    localStorage.setItem(REST_KEY, String(endsAt));
    set({ restEndsAt: endsAt, restDurationSec: dur });
  },

  clearRest: () => {
    localStorage.removeItem(REST_KEY);
    set({ restEndsAt: null });
  },

  addRest: (delta) => {
    const cur = get().restEndsAt ?? Date.now();
    const endsAt = Math.max(Date.now(), cur + delta * 1000);
    localStorage.setItem(REST_KEY, String(endsAt));
    set({ restEndsAt: endsAt });
  },
}));
