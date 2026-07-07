import type { Exercise, Workout } from '@/db/types';
import { estimate1rm, type E1rmFormula } from './e1rm';

export interface SetPoint {
  ts: number;
  weightKg: number;
  reps: number;
  e1rmKg: number;
  volumeKg: number;
}

export interface ExerciseSeries {
  points: SetPoint[]; // top set per session, chronological
  best1rmKg: number;
  bestTopSetKg: number;
  prTimeline: { ts: number; e1rmKg: number }[];
}

function sessionSets(w: Workout, exerciseId: string) {
  const entry = w.entries.find((e) => e.exerciseId === exerciseId);
  if (!entry) return [];
  return entry.sets.filter((s) => s.reps > 0);
}

/** Build a per-exercise time series (one top-set point per session). */
export function buildExerciseSeries(
  workouts: Workout[],
  exerciseId: string,
  formula: E1rmFormula = 'epley',
): ExerciseSeries {
  const done = workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => (a.finishedAt! - b.finishedAt!));
  const points: SetPoint[] = [];
  let best1rm = 0;
  let bestTop = 0;
  const prTimeline: { ts: number; e1rmKg: number }[] = [];
  let runningBest = 0;

  for (const w of done) {
    const sets = sessionSets(w, exerciseId);
    if (sets.length === 0) continue;
    let top = sets[0];
    let sessionBest1rm = 0;
    let volume = 0;
    for (const s of sets) {
      if (s.weightKg > top.weightKg) top = s;
      sessionBest1rm = Math.max(sessionBest1rm, estimate1rm(s.weightKg, s.reps, formula));
      volume += s.weightKg * s.reps;
    }
    const ts = w.finishedAt!;
    points.push({
      ts,
      weightKg: top.weightKg,
      reps: top.reps,
      e1rmKg: sessionBest1rm,
      volumeKg: volume,
    });
    best1rm = Math.max(best1rm, sessionBest1rm);
    bestTop = Math.max(bestTop, top.weightKg);
    if (sessionBest1rm > runningBest + 0.01) {
      runningBest = sessionBest1rm;
      prTimeline.push({ ts, e1rmKg: sessionBest1rm });
    }
  }
  return { points, best1rmKg: best1rm, bestTopSetKg: bestTop, prTimeline };
}

/** Best estimated 1RM for an exercise across all history. */
export function bestE1rm(workouts: Workout[], exerciseId: string, formula: E1rmFormula = 'epley'): number {
  let best = 0;
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    for (const s of sessionSets(w, exerciseId)) {
      best = Math.max(best, estimate1rm(s.weightKg, s.reps, formula));
    }
  }
  return best;
}

export interface WeeklyVolume {
  weekStart: number;
  label: string;
  volumeKg: number;
  sets: number;
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function weeklyVolume(workouts: Workout[], weeks = 8): WeeklyVolume[] {
  const now = Date.now();
  const buckets = new Map<number, WeeklyVolume>();
  const thisWeek = startOfWeek(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = thisWeek - i * 7 * 86400000;
    buckets.set(ws, {
      weekStart: ws,
      label: new Date(ws).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      volumeKg: 0,
      sets: 0,
    });
  }
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const ws = startOfWeek(w.finishedAt);
    const bucket = buckets.get(ws);
    if (!bucket) continue;
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (s.reps > 0) {
          bucket.volumeKg += s.weightKg * s.reps;
          bucket.sets += 1;
        }
      }
    }
  }
  return [...buckets.values()];
}

/** Distinct calendar-day training streak (consecutive days up to today). */
export function computeStreak(workouts: Workout[]): number {
  const days = new Set<number>();
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const d = new Date(w.finishedAt);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  }
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow the streak to count if trained today or yesterday.
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Set-count per muscle group over the last N days, for balance display. */
export function muscleBalance(
  workouts: Workout[],
  exercises: Map<string, Exercise>,
  days = 28,
): { muscle: string; sets: number }[] {
  const since = Date.now() - days * 86400000;
  const counts = new Map<string, number>();
  for (const w of workouts) {
    if (!w.finishedAt || w.finishedAt < since) continue;
    for (const e of w.entries) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const done = e.sets.filter((s) => s.reps > 0).length;
      if (done === 0) continue;
      for (const m of ex.primaryMuscles) counts.set(m, (counts.get(m) ?? 0) + done);
      for (const m of ex.secondaryMuscles) counts.set(m, (counts.get(m) ?? 0) + done * 0.5);
    }
  }
  return [...counts.entries()]
    .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets) }))
    .sort((a, b) => b.sets - a.sets);
}

export interface PRRecord {
  exerciseId: string;
  exerciseName: string;
  e1rmKg: number;
  ts: number;
}

/** Recent PRs across all exercises (most recent first). */
export function recentPRs(
  workouts: Workout[],
  exercises: Map<string, Exercise>,
  limit = 6,
  formula: E1rmFormula = 'epley',
): PRRecord[] {
  const bestByEx = new Map<string, number>();
  const prs: PRRecord[] = [];
  const done = workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => a.finishedAt! - b.finishedAt!);
  for (const w of done) {
    for (const e of w.entries) {
      let sessionBest = 0;
      for (const s of e.sets) {
        if (s.reps > 0) {
          sessionBest = Math.max(sessionBest, estimate1rm(s.weightKg, s.reps, formula));
        }
      }
      if (sessionBest === 0) continue;
      const prev = bestByEx.get(e.exerciseId) ?? 0;
      if (sessionBest > prev + 0.01) {
        bestByEx.set(e.exerciseId, sessionBest);
        prs.push({
          exerciseId: e.exerciseId,
          exerciseName: exercises.get(e.exerciseId)?.name ?? e.exerciseId,
          e1rmKg: sessionBest,
          ts: w.finishedAt!,
        });
      }
    }
  }
  return prs.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export function totalVolume(workouts: Workout[]): number {
  let v = 0;
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    for (const e of w.entries)
      for (const s of e.sets) if (s.reps > 0) v += s.weightKg * s.reps;
  }
  return v;
}
