import type { Intensity, PrescribedExercise, Progression } from '@/schema/program';
import { estimate1rm } from './e1rm';
import { roundToIncrement, toKg, type Unit } from './units';

/** Summary of the last time an exercise was performed, for auto-regulation. */
export interface LastPerformance {
  /** Top set weight in kg. */
  topWeightKg: number;
  /** Reps at the top set. */
  topReps: number;
  /** Best estimated 1RM in kg across the session. */
  bestE1rmKg: number;
  /** Whether all prescribed sets hit their rep target. */
  hitAllTargets: boolean;
  /** Max reps achieved on the top set (for double progression). */
  topRpe?: number;
}

export interface Suggestion {
  weightKg: number;
  reps: number | [number, number];
  rationale: string;
}

function repTop(reps: number | [number, number]): number {
  return Array.isArray(reps) ? reps[1] : reps;
}

/**
 * Resolve the prescribed load for an exercise into a concrete kg suggestion,
 * combining intensity (absolute / %1RM / RPE) with any progression rule and the
 * user's last performance.
 */
export function suggestLoad(
  ex: PrescribedExercise,
  ctx: {
    unit: Unit;
    /** User's current best e1RM (kg) for this exercise, if known. */
    currentE1rmKg?: number;
    /** Last time this exercise was performed. */
    last?: LastPerformance;
  },
): Suggestion {
  const { unit, currentE1rmKg, last } = ctx;

  // 1) Progression rules take priority (some need history, some don't).
  if (ex.progression) {
    const prog = applyProgression(ex.progression, ex, last, unit, currentE1rmKg);
    if (prog) return prog;
  }

  // 2) Otherwise resolve from the intensity prescription.
  if (ex.intensity) {
    const s = fromIntensity(ex.intensity, ex, unit, currentE1rmKg);
    if (s) return s;
  }

  // 3) Fall back to last weight, or leave blank (0 -> user fills in).
  if (last) {
    return {
      weightKg: last.topWeightKg,
      reps: ex.reps,
      rationale: 'Repeat last session load.',
    };
  }
  return { weightKg: 0, reps: ex.reps, rationale: 'No history — enter a starting load.' };
}

function fromIntensity(
  intensity: Intensity,
  ex: PrescribedExercise,
  unit: Unit,
  currentE1rmKg?: number,
): Suggestion | null {
  switch (intensity.type) {
    case 'absolute':
      return {
        weightKg: toKg(intensity.value, unit),
        reps: ex.reps,
        rationale: `Prescribed ${intensity.value} ${unit}.`,
      };
    case 'percent1rm': {
      if (!currentE1rmKg) return null;
      const w = roundToIncrement((intensity.value / 100) * currentE1rmKg, unit);
      return {
        weightKg: w,
        reps: ex.reps,
        rationale: `${intensity.value}% of est. 1RM.`,
      };
    }
    case 'rpe': {
      // Auto-regulate from e1RM using an RPE→%1RM table (reps-in-reserve based).
      if (!currentE1rmKg) return null;
      const pct = rpePercent(intensity.value, repTop(ex.reps));
      const w = roundToIncrement(pct * currentE1rmKg, unit);
      return {
        weightKg: w,
        reps: ex.reps,
        rationale: `RPE ${intensity.value} target (~${Math.round(pct * 100)}% e1RM).`,
      };
    }
  }
}

function applyProgression(
  prog: Progression,
  ex: PrescribedExercise,
  last: LastPerformance | undefined,
  unit: Unit,
  currentE1rmKg?: number,
): Suggestion | null {
  switch (prog.type) {
    case 'linear': {
      if (!last) return null;
      const target = prog.onSuccessRepTarget ?? repTop(ex.reps);
      if (last.hitAllTargets && last.topReps >= target) {
        return {
          weightKg: roundToIncrement(last.topWeightKg + prog.incrementKg, unit),
          reps: ex.reps,
          rationale: `Linear +${prog.incrementKg}kg (hit ${target} reps).`,
        };
      }
      return {
        weightKg: last.topWeightKg,
        reps: ex.reps,
        rationale: 'Repeat load — targets not fully met.',
      };
    }
    case 'double': {
      if (!last) return null;
      const [lo, hi] = prog.repRange;
      if (last.topReps >= hi && last.hitAllTargets) {
        // Climbed to top of range -> add load, reset to bottom.
        return {
          weightKg: roundToIncrement(last.topWeightKg + prog.incrementKg, unit),
          reps: [lo, hi],
          rationale: `Double progression: hit ${hi} reps → +${prog.incrementKg}kg, reset to ${lo}.`,
        };
      }
      return {
        weightKg: last.topWeightKg,
        reps: [lo, hi],
        rationale: `Double progression: add a rep toward ${hi} at same load.`,
      };
    }
    case 'percent-e1rm': {
      const base = currentE1rmKg ?? last?.bestE1rmKg;
      if (!base) return null;
      return {
        weightKg: roundToIncrement((prog.percent / 100) * base, unit),
        reps: ex.reps,
        rationale: `${prog.percent}% of current est. 1RM.`,
      };
    }
  }
}

/**
 * RPE → fraction-of-1RM, using a compact RPE/RIR chart (Reactive Training
 * Systems style). Returns the % of 1RM for a given RPE at a given rep count.
 */
export function rpePercent(rpe: number, reps: number): number {
  // Table: rows RPE 10..6, cols reps 1..12 -> %1RM (0-1).
  const table: Record<number, number[]> = {
    10: [1.0, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68],
    9: [0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.66],
    8: [0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.66, 0.64],
    7: [0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.66, 0.64, 0.62],
    6: [0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.66, 0.64, 0.62, 0.6],
  };
  const rpeKey = Math.max(6, Math.min(10, Math.round(rpe)));
  const row = table[rpeKey] ?? table[8];
  const col = Math.max(1, Math.min(12, Math.round(reps))) - 1;
  return row[col];
}

/** Compute a LastPerformance summary from logged sets of one exercise. */
export function summarizePerformance(
  sets: { weightKg: number; reps: number; completed: boolean; rpe?: number }[],
  formula: 'epley' | 'brzycki' = 'epley',
): LastPerformance | undefined {
  const done = sets.filter((s) => s.completed && s.reps > 0);
  if (done.length === 0) return undefined;
  let top = done[0];
  let bestE1rm = 0;
  for (const s of done) {
    if (s.weightKg > top.weightKg) top = s;
    bestE1rm = Math.max(bestE1rm, estimate1rm(s.weightKg, s.reps, formula));
  }
  return {
    topWeightKg: top.weightKg,
    topReps: top.reps,
    topRpe: top.rpe,
    bestE1rmKg: bestE1rm,
    hitAllTargets: done.every((s) => s.completed),
  };
}
