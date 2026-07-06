import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/db';
import type { Exercise, Workout } from '@/db/types';

export function useExercises(): Exercise[] {
  return useLiveQuery(() => db.exercises.toArray(), [], []) ?? [];
}

export function useExerciseMap(): Map<string, Exercise> {
  const exercises = useExercises();
  return useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
}

export function useFinishedWorkouts(): Workout[] {
  return (
    useLiveQuery(
      () => db.workouts.filter((w) => w.finishedAt !== undefined).toArray(),
      [],
      [],
    ) ?? []
  );
}

export function useAllWorkouts(): Workout[] {
  return useLiveQuery(() => db.workouts.toArray(), [], []) ?? [];
}
