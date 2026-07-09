import { Link } from 'react-router-dom';
import { Chip, HudButton, HudPanel } from '@/components/hud';
import { IconDrop, IconFuel } from '@/components/icons';
import { MacroBar } from '@/components/fuel/MacroBar';
import { useDayFoodLog, useDayWater } from '@/hooks/useLive';
import { uid } from '@/lib/id';
import {
  EMPTY_MACROS,
  addMacros,
  dateKey,
  macrosForAmount,
  waterTargetMl,
} from '@/lib/nutrition';
import { persistWaterLog } from '@/sync/local';
import { useAppStore } from '@/store/useAppStore';

/**
 * Dashboard summary of today's nutrition: calories + macro bars vs targets
 * and hydration progress (with a one-tap glass add), linking into Fuel.
 */
export function FuelTodayPanel() {
  const profile = useAppStore((s) => s.profile);
  const today = dateKey();
  const entries = useDayFoodLog(today);
  const water = useDayWater(today);

  const targets = profile.nutrition?.targets ?? null;
  const totals = entries.reduce(
    (acc, e) => addMacros(acc, macrosForAmount(e.per100, e.amountG)),
    EMPTY_MACROS,
  );
  const waterMl = water.reduce((s, w) => s + w.ml, 0);
  const waterTarget =
    profile.hydration && !profile.hydration.auto
      ? profile.hydration.targetMl
      : waterTargetMl(profile.bodyweightKg, profile.nutrition?.activity ?? 'moderate');
  const waterDone = waterMl >= waterTarget;

  return (
    <HudPanel className="p-4" label="FUEL TODAY" bracketColor="var(--amber)">
      {targets ? (
        <div className="grid gap-x-6 sm:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="mono text-xl font-semibold text-[var(--cyan)]">
                {Math.round(totals.kcal)}
                <span className="ml-1 text-[11px] text-[var(--ink-dim)]">/ {targets.kcal} kcal</span>
              </span>
              <span
                className="mono text-[11px] font-semibold"
                style={{ color: totals.kcal > targets.kcal ? 'var(--down)' : 'var(--up)' }}
              >
                {totals.kcal > targets.kcal
                  ? `${Math.round(totals.kcal - targets.kcal)} over`
                  : `${Math.round(targets.kcal - totals.kcal)} left`}
              </span>
            </div>
            <MacroBar label="CALORIES" eaten={totals.kcal} target={targets.kcal} color="var(--cyan)" unit="kcal" />
            <div className="grid grid-cols-3 gap-3">
              <MacroBar label={`P ${Math.round(totals.proteinG)}/${targets.proteinG}`} eaten={totals.proteinG} target={targets.proteinG} color="var(--cyan)" unit="g" compact />
              <MacroBar label={`C ${Math.round(totals.carbsG)}/${targets.carbsG}`} eaten={totals.carbsG} target={targets.carbsG} color="var(--violet)" unit="g" compact />
              <MacroBar label={`F ${Math.round(totals.fatG)}/${targets.fatG}`} eaten={totals.fatG} target={targets.fatG} color="var(--amber)" unit="g" compact />
            </div>
          </div>

          <div className="mt-4 flex flex-col justify-between sm:mt-0">
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1.5">
                <span style={{ color: waterDone ? 'var(--up)' : 'var(--cyan)' }}>
                  <IconDrop size={15} />
                </span>
                <span className="mono text-xl font-semibold" style={{ color: waterDone ? 'var(--up)' : 'var(--ink)' }}>
                  {(waterMl / 1000).toFixed(1)}
                  <span className="ml-1 text-[11px] text-[var(--ink-dim)]">/ {(waterTarget / 1000).toFixed(1)} L</span>
                </span>
              </span>
              <Chip onClick={() => void persistWaterLog({ id: uid('h2o'), date: today, ml: 250, loggedAt: Date.now() })}>
                +250ml
              </Chip>
            </div>
            <MacroBar label="WATER" eaten={waterMl} target={waterTarget} color="var(--cyan)" unit="ml" overColor="var(--up)" />
            <div className="mt-3 flex justify-end">
              <Link to="/fuel">
                <HudButton variant="ghost" sheen={false} className="!min-h-[34px] !px-3 !text-[10px]">
                  <IconFuel size={13} /> Open Fuel
                </HudButton>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
            Track meals, macros, and water — calibrate targets from your metrics on the Fuel page.
          </p>
          <Link to="/fuel">
            <HudButton variant="ghost" sheen={false}>
              <IconFuel size={15} /> Open Fuel
            </HudButton>
          </Link>
        </div>
      )}
    </HudPanel>
  );
}
