import { db } from '@/db/db';
import type { FoodLogEntry, SavedFood } from '@/db/types';
import { uid } from '@/lib/id';
import type { MacroSet, MealId } from '@/lib/nutrition';

/**
 * Fuel journal persistence. Local-only (IndexedDB) — nutrition data does not
 * participate in cloud sync yet (see DECISIONS.md §12).
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
    updatedAt: Date.now(),
    ...input,
  };
  await db.foodLogs.put(entry);
  await touchSavedFood(input);
  return entry;
}

export async function updateLogEntry(id: string, patch: Partial<FoodLogEntry>): Promise<void> {
  await db.foodLogs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function removeLogEntry(id: string): Promise<void> {
  await db.foodLogs.delete(id);
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
    await db.foods.put({
      id: existing?.id ?? uid('sf'),
      name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      per100: input.per100,
      servingG: input.servingG,
      custom: existing?.custom,
      lastUsedAt: now,
      updatedAt: now,
    });
    return;
  }
  // Manual entries: match by exact name so repeats collapse to one food.
  const existing = await db.foods.filter((f) => !f.barcode && f.name === input.name).first();
  await db.foods.put({
    id: existing?.id ?? uid('sf'),
    name: input.name,
    brand: input.brand,
    per100: input.per100,
    servingG: input.servingG,
    custom: true,
    lastUsedAt: now,
    updatedAt: now,
  });
}

export async function saveCustomFood(
  food: Omit<SavedFood, 'id' | 'lastUsedAt' | 'updatedAt'> & { id?: string },
): Promise<SavedFood> {
  const now = Date.now();
  const saved: SavedFood = { lastUsedAt: now, updatedAt: now, ...food, id: food.id ?? uid('sf') };
  await db.foods.put(saved);
  return saved;
}

export async function removeSavedFood(id: string): Promise<void> {
  await db.foods.delete(id);
}
