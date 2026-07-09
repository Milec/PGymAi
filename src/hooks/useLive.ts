import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/db';
import type { Exercise, FoodLogEntry, SavedFood, Workout, WorkoutPlan } from '@/db/types';

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

/** Saved workout plans, most recently used/created first. */
export function usePlans(): WorkoutPlan[] {
  return (
    useLiveQuery(
      async () =>
        (await db.plans.toArray()).sort(
          (a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt),
        ),
      [],
      [],
    ) ?? []
  );
}

/** Every food-journal entry (for the activity calendar). */
export function useAllFoodLogs(): FoodLogEntry[] {
  return useLiveQuery(() => db.foodLogs.toArray(), [], []) ?? [];
}

/** All food-journal entries for one YYYY-MM-DD day, in logging order. */
export function useDayFoodLog(date: string): FoodLogEntry[] {
  return (
    useLiveQuery(() => db.foodLogs.where('date').equals(date).sortBy('loggedAt'), [date], []) ?? []
  );
}

/** Reusable foods (custom + recently logged), most recently used first. */
export function useSavedFoods(): SavedFood[] {
  return useLiveQuery(() => db.foods.orderBy('lastUsedAt').reverse().toArray(), [], []) ?? [];
}
