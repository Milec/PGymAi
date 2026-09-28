import type { Workout } from '@/db/types';
import type { Program } from '@/schema/program';

/**
 * Where you are in a program, derived from training history rather than stored
 * as a cursor.
 *
 * Every session started from a program day records its `programId`, `weekIndex`
 * and `dayIndex`, so "which days have I done?" is already answerable from the
 * workout log. Deriving it means progress can never drift out of step with the
 * sessions themselves, and a session deleted from the Activity Log correctly
 * un-completes its day.
 */

export type DayKey = `${number}-${number}`;

export const dayKey = (weekIndex: number, dayIndex: number): DayKey => `${weekIndex}-${dayIndex}`;

/**
 * Map of completed program days to when they were last finished. A day trained
 * more than once keeps the most recent timestamp.
 */
export function completedDays(workouts: Workout[], programId: string): Map<DayKey, number> {
  const done = new Map<DayKey, number>();
  for (const w of workouts) {
    if (!w.finishedAt || w.programId !== programId) continue;
    if (w.weekIndex === undefined || w.dayIndex === undefined) continue;
    const key = dayKey(w.weekIndex, w.dayIndex);
    const prev = done.get(key) ?? 0;
    if (w.finishedAt > prev) done.set(key, w.finishedAt);
  }
  return done;
}

export interface ProgramPosition {
  /** Days finished at least once. */
  completed: number;
  /** Days the program prescribes in total. */
  total: number;
  /** The first unfinished day in program order, or null when every day is done. */
  next: { weekIndex: number; dayIndex: number } | null;
}

/** Total prescribed days across every week. */
export function totalDays(program: Program): number {
  return program.weeks.reduce((n, w) => n + w.days.length, 0);
}

/**
 * Summarise progress through a program: how far in, and which day comes next.
 * "Next" is simply the earliest day not yet done — a program followed out of
 * order still points at the first gap rather than skipping past it.
 */
export function programPosition(program: Program, done: Map<DayKey, number>): ProgramPosition {
  let completed = 0;
  let next: ProgramPosition['next'] = null;
  for (let wi = 0; wi < program.weeks.length; wi++) {
    const week = program.weeks[wi];
    for (let di = 0; di < week.days.length; di++) {
      if (done.has(dayKey(wi, di))) completed += 1;
      else if (!next) next = { weekIndex: wi, dayIndex: di };
    }
  }
  return { completed, total: totalDays(program), next };
}
