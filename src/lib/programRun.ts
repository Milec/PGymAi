import type { Exercise, Profile, WorkoutEntry } from '@/db/types';
import { uid } from '@/lib/id';
import { bestE1rm } from '@/lib/analytics';
import { summarizePerformance, suggestLoad } from '@/lib/progression';
import type { Program, PrescribedExercise } from '@/schema/program';
import type { Workout } from '@/db/types';
import { fromKg, type Unit } from '@/lib/units';

function findExercise(name: string, exercises: Exercise[]): Exercise | undefined {
  const lower = name.toLowerCase();
  return (
    exercises.find((e) => e.name.toLowerCase() === lower) ??
    exercises.find((e) => e.name.toLowerCase().includes(lower) || lower.includes(e.name.toLowerCase()))
  );
}

function targetRepsText(pex: PrescribedExercise): string {
  return Array.isArray(pex.reps) ? `${pex.reps[0]}–${pex.reps[1]}` : String(pex.reps);
}

/** Find the most recent finished session's performance for an exercise. */
function lastPerf(workouts: Workout[], exerciseId: string) {
  const done = workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.finishedAt! - a.finishedAt!);
  for (const w of done) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) return summarizePerformance(entry.sets);
  }
  return undefined;
}

export interface BuiltDay {
  entries: WorkoutEntry[];
  unmatched: string[];
}

/** Build prescribed workout entries for a program day, with suggested loads. */
export function buildProgramDay(
  program: Program,
  weekIndex: number,
  dayIndex: number,
  exercises: Exercise[],
  workouts: Workout[],
  profile: Profile,
): BuiltDay {
  const day = program.weeks[weekIndex]?.days[dayIndex];
  const entries: WorkoutEntry[] = [];
  const unmatched: string[] = [];
  if (!day) return { entries, unmatched };

  for (const pex of day.exercises) {
    const ex = findExercise(pex.exerciseName, exercises);
    if (!ex) {
      unmatched.push(pex.exerciseName);
      continue;
    }
    const currentE1rm = bestE1rm(workouts, ex.id) || undefined;
    const last = lastPerf(workouts, ex.id);
    const suggestion = suggestLoad(pex, { unit: profile.units, currentE1rmKg: currentE1rm, last });

    const targetText = targetRepsText(pex);
    const intensityNote = pex.intensity
      ? pex.intensity.type === 'rpe'
        ? `@RPE${pex.intensity.value}`
        : pex.intensity.type === 'percent1rm'
          ? `@${pex.intensity.value}%`
          : `@${pex.intensity.value}${program.units}`
      : '';

    entries.push({
      id: uid('en'),
      exerciseId: ex.id,
      notes: `Prescribed: ${pex.sets}×${targetText} ${intensityNote} · ${suggestion.rationale}`,
      sets: Array.from({ length: pex.sets }, () => ({
        id: uid('set'),
        weightKg: suggestion.weightKg,
        reps: 0,
        completed: false,
        targetReps: pex.reps,
        targetText: suggestion.weightKg
          ? String(Math.round(fromKg(suggestion.weightKg, profile.units) * 100) / 100)
          : undefined,
      })),
    });
  }
  return { entries, unmatched };
}

export function programUnit(program: Program): Unit {
  return program.units;
}
