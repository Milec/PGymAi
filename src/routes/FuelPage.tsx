import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, PageTitle } from '@/components/common';
import { AddFoodModal } from '@/components/fuel/AddFoodModal';
import { EditEntryModal } from '@/components/fuel/EditEntryModal';
import { GoalCalculatorModal } from '@/components/fuel/GoalCalculatorModal';
import { Chip, HudButton, HudPanel, Readout, Tag } from '@/components/hud';
import { IconChevronL, IconChevronR, IconPlus, IconTarget } from '@/components/icons';
import type { FoodLogEntry } from '@/db/types';
import { useDayFoodLog } from '@/hooks/useLive';
import {
  EMPTY_MACROS,
  MEALS,
  addMacros,
  dateKey,
  dateKeyLabel,
  macrosForAmount,
  shiftDateKey,
  type MacroSet,
  type MealId,
} from '@/lib/nutrition';
import { useAppStore } from '@/store/useAppStore';

export function FuelPage() {
  const profile = useAppStore((s) => s.profile);
  const targets = profile.nutrition?.targets ?? null;

  const today = dateKey();
  // Deep link from the Activity Log calendar: /fuel?date=YYYY-MM-DD.
  const [params] = useSearchParams();
  const [date, setDate] = useState(() => {
    const p = params.get('date');
    return p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : today;
  });
  const entries = useDayFoodLog(date);

  const [goalOpen, setGoalOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<MealId | null>(null);
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);

  const { totals, byMeal } = useMemo(() => {
    const byMeal = new Map<MealId, { entries: FoodLogEntry[]; macros: MacroSet }>(
      MEALS.map((m) => [m.id, { entries: [], macros: EMPTY_MACROS }]),
    );
    let totals = EMPTY_MACROS;
    for (const e of entries) {
      const macros = macrosForAmount(e.per100, e.amountG);
      totals = addMacros(totals, macros);
      const bucket = byMeal.get(e.meal)!;
      bucket.entries.push(e);
      bucket.macros = addMacros(bucket.macros, macros);
    }
    return { totals, byMeal };
  }, [entries]);

  return (
    <div>
      <PageTitle
        title="Fuel"
        sub="Daily food journal & macro targets."
        right={
          <HudButton variant="ghost" sheen={false} onClick={() => setGoalOpen(true)}>
            <IconTarget size={16} /> Targets
          </HudButton>
        }
      />

      {/* Day navigator */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous day"
            onClick={() => setDate((d) => shiftDateKey(d, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--ink-dim)] transition-colors hover:text-[var(--cyan)]"
          >
            <IconChevronL size={16} />
          </button>
          <span className="font-head min-w-[130px] text-center text-[12px] tracking-[0.14em] text-[var(--ink)]">
            {dateKeyLabel(date)}
          </span>
          <button
            aria-label="Next day"
            onClick={() => setDate((d) => shiftDateKey(d, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--ink-dim)] transition-colors hover:text-[var(--cyan)]"
          >
            <IconChevronR size={16} />
          </button>
        </div>
        {date !== today && (
          <Chip onClick={() => setDate(today)} color="var(--amber)">
            Back to today
          </Chip>
        )}
      </div>

      {/* Energy & macros vs targets */}
      <HudPanel className="mb-4 p-5" label="ENERGY" glow>
        {targets ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Readout
                label="CONSUMED"
                value={Math.round(totals.kcal)}
                unit={`/ ${targets.kcal} kcal`}
                size="lg"
                color="var(--cyan)"
              />
              <Readout
                label={totals.kcal > targets.kcal ? 'OVER' : 'REMAINING'}
                value={Math.abs(Math.round(targets.kcal - totals.kcal))}
                unit="kcal"
                size="md"
                color={totals.kcal > targets.kcal ? 'var(--down)' : 'var(--up)'}
                flash={false}
              />
            </div>
            <MacroBar label="CALORIES" eaten={totals.kcal} target={targets.kcal} color="var(--cyan)" unit="kcal" />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MacroBar label="PROTEIN" eaten={totals.proteinG} target={targets.proteinG} color="var(--cyan)" unit="g" />
              <MacroBar label="CARBS" eaten={totals.carbsG} target={targets.carbsG} color="var(--violet)" unit="g" />
              <MacroBar label="FAT" eaten={totals.fatG} target={targets.fatG} color="var(--amber)" unit="g" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-[13px] leading-relaxed text-[var(--ink-dim)]">
              Set your macro targets — calculated from your weight, height, age, sex, training
              frequency, and goal — or enter them manually.
            </p>
            <HudButton onClick={() => setGoalOpen(true)}>
              <IconTarget size={16} /> Calibrate Targets
            </HudButton>
          </div>
        )}
      </HudPanel>

      {/* Meal journal */}
      {entries.length === 0 && (
        <div className="mb-4">
          <EmptyState title="NOTHING LOGGED">
            Log your first food of the day — search the catalogue, scan a barcode, or add a custom
            food.
          </EmptyState>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {MEALS.map((meal) => {
          const bucket = byMeal.get(meal.id)!;
          return (
            <HudPanel key={meal.id} className="p-4" label={meal.label.toUpperCase()} bracketColor="var(--amber)">
              <div className="mb-1 flex items-center justify-between">
                <span className="mono text-[11px] text-[var(--ink-dim)]">
                  {bucket.entries.length > 0 ? (
                    <>
                      {Math.round(bucket.macros.kcal)} kcal · P {Math.round(bucket.macros.proteinG)} · C{' '}
                      {Math.round(bucket.macros.carbsG)} · F {Math.round(bucket.macros.fatG)}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <HudButton
                  variant="ghost"
                  sheen={false}
                  className="!min-h-[34px] px-2.5 text-[10px]"
                  onClick={() => setAddMeal(meal.id)}
                  aria-label={`Add food to ${meal.label}`}
                >
                  <IconPlus size={14} /> Add
                </HudButton>
              </div>
              {bucket.entries.length > 0 && (
                <div className="mt-1 divide-y divide-[var(--line)]">
                  {bucket.entries.map((e) => (
                    <EntryRow key={e.id} entry={e} onClick={() => setEditing(e)} />
                  ))}
                </div>
              )}
            </HudPanel>
          );
        })}
      </div>

      <p className="mt-5 text-center text-[10px] text-[var(--ink-faint)]">
        Catalogue data from Open Food Facts (openfoodfacts.org) and USDA FoodData Central · logged
        foods are stored on this device and back up with Cloud Sync
      </p>

      <GoalCalculatorModal open={goalOpen} onClose={() => setGoalOpen(false)} />
      {addMeal && (
        <AddFoodModal open onClose={() => setAddMeal(null)} date={date} initialMeal={addMeal} />
      )}
      <EditEntryModal entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EntryRow({ entry, onClick }: { entry: FoodLogEntry; onClick: () => void }) {
  const m = macrosForAmount(entry.per100, entry.amountG);
  const servings = entry.servingG ? entry.amountG / entry.servingG : null;
  const amount =
    servings && Math.abs(servings - Math.round(servings * 2) / 2) < 0.01
      ? `${Math.round(servings * 2) / 2} × ${entry.servingG}g`
      : `${Math.round(entry.amountG)}g`;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors hover:bg-[rgba(120,200,255,0.05)]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-[var(--ink)]">{entry.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="mono text-[10px] text-[var(--ink-faint)]">{amount}</span>
          {entry.brand && <Tag>{entry.brand}</Tag>}
        </span>
      </span>
      <span className="mono shrink-0 text-right text-[11px] leading-tight">
        <span className="block text-[13px] font-semibold text-[var(--ink)]">{Math.round(m.kcal)}</span>
        <span className="text-[9px] text-[var(--ink-faint)]">
          P{Math.round(m.proteinG)} C{Math.round(m.carbsG)} F{Math.round(m.fatG)}
        </span>
      </span>
    </button>
  );
}

/** Progress toward one macro target; overshoot turns the bar red. */
function MacroBar({
  label,
  eaten,
  target,
  color,
  unit,
}: {
  label: string;
  eaten: number;
  target: number;
  color: string;
  unit: string;
}) {
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  const over = eaten > target && target > 0;
  const barColor = over ? 'var(--down)' : color;
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-head text-[9px] tracking-[0.2em] text-[var(--ink-faint)]">{label}</span>
        <span className="mono text-[10px] text-[var(--ink-dim)]">
          {Math.round(eaten)} / {target} {unit}
        </span>
      </div>
      <div
        className="h-[6px] overflow-hidden rounded-full"
        style={{ background: 'rgba(120,200,255,0.08)', border: '1px solid var(--line)' }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(eaten)}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
        />
      </div>
    </div>
  );
}
