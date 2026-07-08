import { db } from '@/db/db';
import type { FoodLogEntry, SavedFood } from '@/db/types';
import { uid } from '@/lib/id';
import type { MacroSet, MealId } from '@/lib/nutrition';
import { persistFood, persistFoodLog, removeFood, removeFoodLog } from '@/sync/local';

/**
 * Fuel journal persistence. Writes go through the sync-aware helpers so the
 * journal and reusable foods back up to Supabase when cloud sync is active
 * (and stay purely local otherwise).
 */

export interface LogFoodInput {
  date: string;
  meal: MealId;
  name: string;
  brand?: string;
  per100: MacroSet;
  amountG: number;
  servingG?: number;
  barcode?: string;
}

export async function logFood(input: LogFoodInput): Promise<FoodLogEntry> {
  const entry: FoodLogEntry = {
    id: uid('food'),
    loggedAt: Date.now(),
    ...input,
  };
  await persistFoodLog(entry);
  await touchSavedFood(input);
  return entry;
}

export async function updateLogEntry(id: string, patch: Partial<FoodLogEntry>): Promise<void> {
  const existing = await db.foodLogs.get(id);
  if (!existing) return;
  await persistFoodLog({ ...existing, ...patch });
}

export async function removeLogEntry(id: string): Promise<void> {
  await removeFoodLog(id);
}

/** Copy a logged entry to another day/meal (quick re-log). */
export async function relogEntry(e: FoodLogEntry, date: string, meal: MealId): Promise<void> {
  await logFood({
    date,
    meal,
    name: e.name,
    brand: e.brand,
    per100: e.per100,
    amountG: e.amountG,
    servingG: e.servingG,
    barcode: e.barcode,
  });
}

/**
 * Keep the reusable-foods cache fresh: catalogue foods are keyed by barcode,
 * so re-logging the same product updates one row. Custom foods keep their id.
 */
async function touchSavedFood(input: LogFoodInput): Promise<void> {
  const now = Date.now();
  if (input.barcode) {
    const existing = await db.foods.where('barcode').equals(input.barcode).first();
    await persistFood({
      id: existing?.id ?? uid('sf'),
      name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      per100: input.per100,
      servingG: input.servingG,
      custom: existing?.custom,
      lastUsedAt: now,
    });
    return;
  }
  // Manual entries: match by exact name so repeats collapse to one food.
  const existing = await db.foods.filter((f) => !f.barcode && f.name === input.name).first();
  await persistFood({
    id: existing?.id ?? uid('sf'),
    name: input.name,
    brand: input.brand,
    per100: input.per100,
    servingG: input.servingG,
    custom: true,
    lastUsedAt: now,
  });
}

export async function saveCustomFood(
  food: Omit<SavedFood, 'id' | 'lastUsedAt' | 'updatedAt'> & { id?: string },
): Promise<SavedFood> {
  return persistFood({ lastUsedAt: Date.now(), ...food, id: food.id ?? uid('sf') });
}

export async function removeSavedFood(id: string): Promise<void> {
  await removeFood(id);
}
