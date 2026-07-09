import { useState } from 'react';
import { Chip, Field, HudButton, HudInput, HudPanel, Modal } from '@/components/hud';
import { IconDrop } from '@/components/icons';
import { useDayWater } from '@/hooks/useLive';
import { uid } from '@/lib/id';
import {
  ACTIVITY_LEVELS,
  WATER_QUICK_ADDS_ML,
  waterTargetMl,
  type ActivityLevel,
} from '@/lib/nutrition';
import { formatWeight } from '@/lib/units';
import { persistWaterLog, removeWaterLog } from '@/sync/local';
import { useAppStore } from '@/store/useAppStore';

/**
 * Hydration tracker for one journal day. The target follows the same scheme
 * as macro targets: auto-derived from the user's metrics (bodyweight ×
 * ~33 ml/kg + an activity bump) with a manual override, stored on the
 * profile so it syncs. Intake logs are per-event so the last add can be
 * undone, and they back up like the food journal.
 */

function fmtL(ml: number): string {
  return (ml / 1000).toFixed(ml % 1000 === 0 ? 1 : 2).replace(/0$/, '').replace(/\.$/, '.0');
}

export function HydrationPanel({ date }: { date: string }) {
  const profile = useAppStore((s) => s.profile);
  const logs = useDayWater(date);
  const [targetOpen, setTargetOpen] = useState(false);

  // Auto target out of the box: derive from current metrics until the user
  // pins one (auto targets track bodyweight/activity changes live).
  const activity: ActivityLevel = profile.nutrition?.activity ?? 'moderate';
  const autoTarget = waterTargetMl(profile.bodyweightKg, activity);
  const hydration = profile.hydration;
  const targetMl = hydration && !hydration.auto ? hydration.targetMl : autoTarget;

  const totalMl = logs.reduce((s, l) => s + l.ml, 0);
  const pct = targetMl > 0 ? Math.min(100, (totalMl / targetMl) * 100) : 0;
  const done = totalMl >= targetMl;

  const add = (ml: number) =>
    void persistWaterLog({ id: uid('h2o'), date, ml, loggedAt: Date.now() });
  const undo = () => {
    const last = logs[logs.length - 1];
    if (last) void removeWaterLog(last.id);
  };

  return (
    <HudPanel className="mb-4 p-4" label="HYDRATION">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span style={{ color: done ? 'var(--up)' : 'var(--cyan)' }}>
            <IconDrop size={18} />
          </span>
          <span className="mono text-[15px] font-semibold" style={{ color: done ? 'var(--up)' : 'var(--ink)' }}>
            {fmtL(totalMl)}
            <span className="text-[11px] text-[var(--ink-dim)]"> / {fmtL(targetMl)} L</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {WATER_QUICK_ADDS_ML.map((ml) => (
            <Chip key={ml} onClick={() => add(ml)}>
              +{ml < 1000 ? `${ml}ml` : `${ml / 1000}L`}
            </Chip>
          ))}
          <button
            onClick={undo}
            disabled={logs.length === 0}
            className="mono h-[34px] rounded-full border border-[var(--line)] px-2.5 text-[10px] text-[var(--ink-dim)] transition-colors hover:text-[var(--down)] disabled:opacity-30"
            aria-label="Undo last water"
          >
            undo
          </button>
        </div>
      </div>

      <div
        className="mt-3 h-[6px] w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(120,200,255,0.08)', border: '1px solid var(--line)' }}
        role="progressbar"
        aria-label="Water"
        aria-valuenow={totalMl}
        aria-valuemin={0}
        aria-valuemax={targetMl}
      >
        <span
          className="block h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: done ? 'var(--up)' : 'var(--cyan)',
            boxShadow: `0 0 8px ${done ? 'var(--up)' : 'var(--cyan)'}`,
          }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--ink-faint)]">
        <span>
          {hydration && !hydration.auto
            ? 'manual target'
            : `auto · ${formatWeight(profile.bodyweightKg, profile.units, 0)} ${profile.units} · ${ACTIVITY_LEVELS.find((a) => a.id === activity)?.label.toLowerCase()}`}
        </span>
        <button className="underline transition-colors hover:text-[var(--cyan)]" onClick={() => setTargetOpen(true)}>
          adjust target
        </button>
      </div>

      {targetOpen && (
        <WaterTargetModal autoTarget={autoTarget} activity={activity} onClose={() => setTargetOpen(false)} />
      )}
    </HudPanel>
  );
}

function WaterTargetModal({
  autoTarget,
  activity,
  onClose,
}: {
  autoTarget: number;
  activity: ActivityLevel;
  onClose: () => void;
}) {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const [mode, setMode] = useState<'auto' | 'manual'>(profile.hydration?.auto === false ? 'manual' : 'auto');
  const [manualMl, setManualMl] = useState(() => String(profile.hydration?.targetMl ?? autoTarget));

  const apply = async () => {
    const targetMl = mode === 'auto' ? autoTarget : Math.max(0, Math.round(parseFloat(manualMl) || 0));
    if (targetMl <= 0) return;
    await updateProfile({ hydration: { targetMl, auto: mode === 'auto' } });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="WATER TARGET">
      <div className="mb-4 flex gap-2">
        <Chip active={mode === 'auto'} onClick={() => setMode('auto')}>
          Calculate for me
        </Chip>
        <Chip active={mode === 'manual'} onClick={() => setMode('manual')}>
          Set manually
        </Chip>
      </div>

      {mode === 'auto' ? (
        <div
          className="mono rounded-[3px] border border-[var(--line)] p-3 text-[12px] text-[var(--ink-dim)]"
          style={{ background: 'rgba(120,200,255,0.04)' }}
        >
          <div className="flex items-baseline justify-between">
            <span>~33 ml/kg × {Math.round(profile.bodyweightKg)} kg</span>
            <span>{Math.round(33 * profile.bodyweightKg)} ml</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span>+ activity ({ACTIVITY_LEVELS.find((a) => a.id === activity)?.label.toLowerCase()})</span>
            <span>{autoTarget - Math.round(33 * profile.bodyweightKg) > 0 ? '+' : ''}{autoTarget - Math.round(33 * profile.bodyweightKg)} ml</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-[var(--line)] pt-2 text-[var(--cyan)]">
            <span>Daily target</span>
            <span className="text-base font-semibold">{fmtL(autoTarget)} L</span>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
            Tracks your bodyweight and training frequency automatically. A common planning
            heuristic — not medical advice.
          </p>
        </div>
      ) : (
        <Field label="Daily target (ml)">
          <HudInput
            type="number"
            inputMode="numeric"
            value={manualMl}
            onChange={(e) => setManualMl(e.target.value)}
            placeholder="2500"
          />
        </Field>
      )}

      <HudButton className="mt-5 w-full" onClick={() => void apply()}>
        Apply Target
      </HudButton>
    </Modal>
  );
}
