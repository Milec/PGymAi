import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle, EmptyState } from '@/components/common';
import { ExercisePicker } from '@/components/ExercisePicker';
import { PlannerPanel } from '@/components/Planner';
import { RestTimer } from '@/components/RestTimer';
import { Chip, HudButton, HudPanel, HudInput, Readout, Tag } from '@/components/hud';
import { IconCheck, IconChevronDown, IconLift, IconPlate, IconPlus, IconTrash } from '@/components/icons';
import { useExerciseMap, useFinishedWorkouts } from '@/hooks/useLive';
import { useNow } from '@/hooks/useNow';
import type { Equipment } from '@/data/muscles';
import type { LoggedSet, WorkoutEntry } from '@/db/types';
import { bestE1rm } from '@/lib/analytics';
import { e1rmBreakdown } from '@/lib/e1rm';
import { rpePercent } from '@/lib/progression';
import { formatDuration } from '@/lib/time';
import { computePlateLoad, isBarbellEquipment } from '@/lib/plates';
import { formatWeight, fromKg, roundKgToIncrement, toKg, type Unit } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

export function WorkoutPage() {
  const active = useAppStore((s) => s.active);
  const startWorkout = useAppStore((s) => s.startWorkout);

  if (!active) {
    return (
      <div>
        <PageTitle title="Workout" sub="Plan ahead or launch a session and start logging." />
        <div className="mb-4">
          <EmptyState title="No Active Session">
            <div className="mb-5">
              Start a freestyle session to log any exercise, launch a saved plan below, or follow a
              structured program day from the Programs screen.
            </div>
            <div className="flex justify-center gap-3">
              <HudButton onClick={() => void startWorkout()}>
                <IconLift size={16} /> Start Freestyle
              </HudButton>
            </div>
          </EmptyState>
        </div>
        <PlannerPanel />
      </div>
    );
  }
  return <ActiveSession />;
}

function ActiveSession() {
  const active = useAppStore((s) => s.active)!;
  const addEntry = useAppStore((s) => s.addEntry);
  const finishWorkout = useAppStore((s) => s.finishWorkout);
  const discardWorkout = useAppStore((s) => s.discardWorkout);
  const profile = useAppStore((s) => s.profile);
  const setRestDocked = useAppStore((s) => s.setRestDocked);
  const now = useNow();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const restRef = useRef<HTMLDivElement>(null);

  // Dock the rest timer into the top banner once the inline one scrolls above
  // it, so an active countdown is always reachable. The top margin roughly
  // matches the mobile banner height.
  useEffect(() => {
    const el = restRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const scrolledAbove = entry.boundingClientRect.top < 0;
        setRestDocked(!entry.isIntersecting && scrolledAbove);
      },
      { rootMargin: '-60px 0px 0px 0px', threshold: 0 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      setRestDocked(false);
    };
  }, [setRestDocked]);

  const elapsed = Math.floor((now - active.startedAt) / 1000);
  const totalSets = active.entries.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const totalVolume = active.entries.reduce(
    (v, e) => v + e.sets.reduce((sv, s) => sv + (s.completed ? s.weightKg * s.reps : 0), 0),
    0,
  );

  const finish = async () => {
    const id = await finishWorkout();
    navigate(id ? '/progress' : '/');
  };
  const discard = async () => {
    if (confirm('Discard this session? Logged sets will be lost.')) {
      await discardWorkout();
      navigate('/');
    }
  };

  return (
    <div>
      <PageTitle title={active.title} sub={active.programId ? 'Program session' : 'Freestyle session'} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <HudPanel className="min-w-0 p-3" glow>
          <Readout label="Duration" value={formatDuration(elapsed)} size="md" flash={false} color="var(--cyan)" />
        </HudPanel>
        <HudPanel className="min-w-0 p-3">
          <Readout label="Sets Done" value={totalSets} size="md" color="var(--violet)" />
        </HudPanel>
        <HudPanel className="min-w-0 p-3">
          <Readout
            label="Volume"
            value={Math.round(fromKg(totalVolume, profile.units)).toLocaleString()}
            unit={profile.units}
            size="md"
            color="var(--amber)"
          />
        </HudPanel>
      </div>

      <div ref={restRef} className="mb-4">
        <RestTimer />
      </div>

      <div className="flex flex-col gap-4">
        {active.entries.map((entry) => (
          <ExerciseCard key={entry.id} entry={entry} />
        ))}
      </div>

      {active.entries.length === 0 && (
        <div className="my-4">
          <EmptyState title="Empty Session">Add your first exercise to begin logging sets.</EmptyState>
        </div>
      )}

      <div className="mt-4">
        <HudButton variant="ghost" className="w-full" onClick={() => setPickerOpen(true)}>
          <IconPlus size={16} /> Add Exercise
        </HudButton>
      </div>

      <div className="mt-6 flex gap-3">
        <HudButton variant="accent" className="flex-1" onClick={finish} disabled={totalSets === 0}>
          <IconCheck size={16} /> Finish Session
        </HudButton>
        <HudButton variant="danger" sheen={false} onClick={discard}>
          Discard
        </HudButton>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addEntry} />
    </div>
  );
}

function ExerciseCard({ entry }: { entry: WorkoutEntry }) {
  const exMap = useExerciseMap();
  const removeEntry = useAppStore((s) => s.removeEntry);
  const addSet = useAppStore((s) => s.addSet);
  const setEntryNotes = useAppStore((s) => s.setEntryNotes);
  const updateSet = useAppStore((s) => s.updateSet);
  const ex = exMap.get(entry.exerciseId);
  const [showPlates, setShowPlates] = useState(false);
  const collapsed = useAppStore((s) => s.collapsedEntries.includes(entry.id));
  const toggleEntryCollapsed = useAppStore((s) => s.toggleEntryCollapsed);
  const barbell = isBarbellEquipment(ex?.equipment);
  // "Next set" = the first set still to be done, else the last one.
  const nextSet = entry.sets.find((s) => !s.completed) ?? entry.sets[entry.sets.length - 1];
  const doneCount = entry.sets.filter((s) => s.completed).length;
  const topKg = entry.sets.reduce((m, s) => (s.completed && s.weightKg > m ? s.weightKg : m), 0);

  const best = useMemo(() => {
    let b = 0;
    for (const s of entry.sets) {
      if (s.completed && s.weightKg > 0 && s.reps > 0) {
        b = Math.max(b, e1rmBreakdown(s.weightKg, s.reps).epley);
      }
    }
    return b;
  }, [entry.sets]);
  const profile = useAppStore((s) => s.profile);
  const finished = useFinishedWorkouts();
  // Effective 1RM: a manually-entered PR wins, else best estimated 1RM from history.
  const oneRmKg = profile.prs?.[entry.exerciseId] || bestE1rm(finished, entry.exerciseId);
  // With a 1RM, add a per-set % column (weight ↔ % auto-fill each other).
  const gridCols =
    oneRmKg > 0
      ? 'grid-cols-[18px_1.15fr_44px_0.85fr_36px_34px_22px]'
      : 'grid-cols-[24px_1fr_1fr_46px_40px_26px]';

  return (
    <HudPanel className="p-4" label={ex?.equipment.toUpperCase()}>
      <div className={`flex items-start justify-between gap-2 ${collapsed ? '' : 'mb-3'}`}>
        <button
          onClick={() => toggleEntryCollapsed(entry.id)}
          className="flex min-w-0 items-start gap-2 text-left"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand exercise' : 'Collapse exercise'}
        >
          <span
            className="mt-1 shrink-0 text-[var(--ink-faint)] transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}
          >
            <IconChevronDown size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-[var(--ink)]">
              {ex?.name ?? entry.exerciseId}
            </span>
            {collapsed ? (
              <span className="mono mt-1 block text-[11px] text-[var(--ink-faint)]">
                {doneCount}/{entry.sets.length} sets
                {topKg > 0 ? ` · top ${formatWeight(topKg, profile.units)} ${profile.units}` : ''}
              </span>
            ) : (
              <span className="mt-1 flex flex-wrap gap-1">
                {ex?.primaryMuscles.map((m) => (
                  <Tag key={m} color="var(--cyan)">
                    {m}
                  </Tag>
                ))}
              </span>
            )}
          </span>
        </button>
        <div className="flex items-center gap-3">
          {best > 0 && (
            <div className="text-right">
              <div className="font-head text-[8px] tracking-widest text-[var(--ink-faint)]">EST 1RM</div>
              <div className="mono text-sm font-semibold text-[var(--amber)]">
                {formatWeight(best, profile.units)} {profile.units}
              </div>
            </div>
          )}
          {barbell && !collapsed && (
            <button
              onClick={() => setShowPlates((v) => !v)}
              className="chamfer flex h-9 w-9 items-center justify-center border transition-all"
              style={{
                borderColor: showPlates ? 'var(--cyan)' : 'var(--line-strong)',
                background: showPlates ? 'rgba(45,212,255,0.14)' : 'transparent',
                color: showPlates ? 'var(--cyan)' : 'var(--ink-faint)',
                boxShadow: showPlates ? '0 0 12px rgba(45,212,255,0.35)' : 'none',
              }}
              aria-label="Plate calculator"
              aria-pressed={showPlates}
              title="Plate calculator"
            >
              <IconPlate size={18} />
            </button>
          )}
          <button
            onClick={() => removeEntry(entry.id)}
            className="text-[var(--ink-faint)] transition-colors hover:text-[var(--down)]"
            aria-label="Remove exercise"
          >
            <IconTrash size={18} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
      {barbell && showPlates && (
        <PlateCalc
          weightKg={nextSet?.weightKg ?? 0}
          reps={nextSet?.reps ?? 0}
          setIndex={nextSet ? entry.sets.indexOf(nextSet) + 1 : 0}
          unit={profile.units}
          equipment={ex?.equipment}
        />
      )}

      <AutoFill
        oneRmKg={oneRmKg}
        unit={profile.units}
        onApply={(weightKg, reps) => {
          for (const s of entry.sets) {
            updateSet(entry.id, s.id, reps != null ? { weightKg, reps } : { weightKg });
          }
        }}
      />

      {/* header row */}
      <div className={`mono grid ${gridCols} gap-2 px-1 pb-1 text-[9px] uppercase tracking-wider text-[var(--ink-faint)]`}>
        <span>#</span>
        <span>{profile.units}</span>
        {oneRmKg > 0 && <span>%</span>}
        <span>Reps</span>
        <span>RPE</span>
        <span className="text-center">Done</span>
        <span />
      </div>

      <div className="flex flex-col gap-1.5">
        {entry.sets.map((s, i) => (
          <SetRow key={s.id} entryId={entry.id} set={s} index={i + 1} oneRmKg={oneRmKg} gridCols={gridCols} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <HudButton variant="ghost" sheen={false} className="!min-h-[38px] flex-1" onClick={() => addSet(entry.id)}>
          <IconPlus size={14} /> Add Set
        </HudButton>
      </div>

      <input
        value={entry.notes ?? ''}
        onChange={(e) => setEntryNotes(entry.id, e.target.value)}
        placeholder="Notes…"
        className="mono mt-3 w-full rounded-[3px] border border-[var(--line)] bg-transparent px-2 py-1.5 text-[12px] text-[var(--ink-dim)] outline-none focus:border-[var(--cyan)]"
      />
        </>
      )}
    </HudPanel>
  );
}

function PlateCalc({
  weightKg,
  reps,
  setIndex,
  unit,
  equipment,
}: {
  weightKg: number;
  reps: number;
  setIndex: number;
  unit: Unit;
  equipment?: Equipment;
}) {
  const load = weightKg > 0 ? computePlateLoad(weightKg, unit, equipment) : null;

  return (
    <div className="mb-3 rounded-[3px] border border-[var(--cyan)]/40 bg-[rgba(45,212,255,0.05)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-head text-[9px] tracking-widest text-[var(--cyan)]">
          ⚖ PLATES · SET {setIndex || '—'}
        </span>
        {load && (
          <span className="mono text-[10px] text-[var(--ink-faint)]">
            {formatWeight(toKg(load.bar, unit), unit)} {unit} bar
          </span>
        )}
      </div>

      {weightKg <= 0 ? (
        <p className="text-[11px] leading-relaxed text-[var(--ink-faint)]">
          Enter or auto-fill a weight for your next set to see the plate math.
        </p>
      ) : !load ? (
        <p className="text-[11px] leading-relaxed text-[var(--ink-faint)]">
          {formatWeight(weightKg, unit)} {unit} is at or below the empty bar — no plates needed.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="mono text-lg font-semibold text-[var(--ink)]">
              {load.target} {unit}
            </span>
            {reps > 0 && <span className="mono text-[11px] text-[var(--ink-faint)]">× {reps}</span>}
            <span className="mono text-[10px] text-[var(--ink-faint)]">per side →</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {load.perSide.length === 0 ? (
              <span className="mono text-[12px] text-[var(--ink-dim)]">just the bar</span>
            ) : (
              load.perSide.map((p) => (
                <span
                  key={p.plate}
                  className="mono flex items-center gap-1 rounded-[3px] border border-[var(--line-strong)] px-2 py-1 text-[12px] text-[var(--ink)]"
                >
                  <span className="text-[var(--cyan)]">{p.count}×</span>
                  {p.plate}
                </span>
              ))
            )}
          </div>
          {!load.exact && (
            <p className="mt-2 text-[10px] text-[var(--amber)]">
              Closest with standard plates is {load.loaded} {unit} ({load.remainder} {unit} short).
            </p>
          )}
        </>
      )}
    </div>
  );
}

function AutoFill({
  oneRmKg,
  unit,
  onApply,
}: {
  oneRmKg: number;
  unit: Unit;
  onApply: (weightKg: number, reps?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'percent' | 'rpe'>('percent');
  const [percent, setPercent] = useState('80');
  const [rpe, setRpe] = useState('8');
  const [reps, setReps] = useState('5');

  const hasPr = oneRmKg > 0;
  const computed = (() => {
    if (!hasPr) return 0;
    if (mode === 'percent') {
      const p = parseFloat(percent);
      if (!p) return 0;
      return roundKgToIncrement((p / 100) * oneRmKg, unit);
    }
    const r = parseFloat(rpe);
    const n = parseInt(reps);
    if (!r || !n) return 0;
    return roundKgToIncrement(rpePercent(r, n) * oneRmKg, unit);
  })();

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-head flex w-full items-center justify-between rounded-[3px] border border-[var(--line)] px-2.5 py-1.5 text-[9px] tracking-widest text-[var(--ink-dim)] transition-colors hover:border-[var(--cyan)]"
      >
        <span>⚡ AUTO-FILL WEIGHT</span>
        <span className="mono text-[var(--ink-faint)]">
          {hasPr ? `1RM ${formatWeight(oneRmKg, unit)} ${unit}` : 'no 1RM'} {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-[3px] border border-[var(--line)] p-3">
          {!hasPr ? (
            <p className="text-[11px] leading-relaxed text-[var(--ink-faint)]">
              No 1RM yet. Set one in the Library (1RM PR) or log this lift once, then STRIDE can
              compute working weights.
            </p>
          ) : (
            <>
              <div className="mb-2 flex gap-2">
                <Chip active={mode === 'percent'} onClick={() => setMode('percent')}>
                  %1RM
                </Chip>
                <Chip active={mode === 'rpe'} onClick={() => setMode('rpe')} color="var(--violet)">
                  RPE
                </Chip>
              </div>
              <div className="flex items-end gap-2">
                {mode === 'percent' ? (
                  <label className="flex-1">
                    <span className="font-head text-[9px] tracking-widest text-[var(--ink-faint)]">PERCENT</span>
                    <HudInput type="number" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} />
                  </label>
                ) : (
                  <>
                    <label className="flex-1">
                      <span className="font-head text-[9px] tracking-widest text-[var(--ink-faint)]">RPE</span>
                      <HudInput type="number" inputMode="decimal" step="0.5" value={rpe} onChange={(e) => setRpe(e.target.value)} />
                    </label>
                    <label className="flex-1">
                      <span className="font-head text-[9px] tracking-widest text-[var(--ink-faint)]">REPS</span>
                      <HudInput type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
                    </label>
                  </>
                )}
                <div className="text-right">
                  <div className="font-head text-[8px] tracking-widest text-[var(--ink-faint)]">WEIGHT</div>
                  <div className="mono text-lg font-semibold text-[var(--amber)]">
                    {computed ? formatWeight(computed, unit) : '—'}
                  </div>
                </div>
              </div>
              <HudButton
                variant="accent"
                sheen={false}
                className="mt-3 w-full !min-h-[38px]"
                disabled={!computed}
                onClick={() => {
                  if (!computed) return;
                  onApply(computed, mode === 'rpe' ? parseInt(reps) : undefined);
                  setOpen(false);
                }}
              >
                Fill all sets{mode === 'rpe' ? ' + reps' : ''}
              </HudButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SetRow({
  entryId,
  set,
  index,
  oneRmKg,
  gridCols,
}: {
  entryId: string;
  set: LoggedSet;
  index: number;
  oneRmKg: number;
  gridCols: string;
}) {
  const updateSet = useAppStore((s) => s.updateSet);
  const removeSet = useAppStore((s) => s.removeSet);
  const toggleComplete = useAppStore((s) => s.toggleComplete);
  const unit = useAppStore((s) => s.profile.units);

  const weightDisplay = set.weightKg ? String(Math.round(fromKg(set.weightKg, unit) * 100) / 100) : '';
  // % of 1RM derived from the current weight — the two fields auto-fill each other.
  const percentDisplay = oneRmKg > 0 && set.weightKg > 0 ? String(Math.round((set.weightKg / oneRmKg) * 100)) : '';

  return (
    <div
      className={`mono grid ${gridCols} items-center gap-2 rounded-[3px] px-1 py-1 transition-colors`}
      style={set.completed ? { background: 'rgba(56,247,176,0.08)' } : {}}
    >
      <span className="text-center text-[12px] text-[var(--ink-faint)]">{index}</span>
      <input
        type="number"
        inputMode="decimal"
        value={weightDisplay}
        placeholder={set.targetText ?? '0'}
        onChange={(e) => updateSet(entryId, set.id, { weightKg: toKg(parseFloat(e.target.value) || 0, unit) })}
        className="cell"
      />
      {oneRmKg > 0 && (
        <input
          type="number"
          inputMode="numeric"
          value={percentDisplay}
          placeholder="%"
          onChange={(e) => {
            const pct = parseFloat(e.target.value);
            const weightKg = pct > 0 ? roundKgToIncrement((pct / 100) * oneRmKg, unit) : 0;
            updateSet(entryId, set.id, { weightKg });
          }}
          className="cell"
          aria-label="Percent of 1RM"
        />
      )}
      <input
        type="number"
        inputMode="numeric"
        value={set.reps || ''}
        placeholder={Array.isArray(set.targetReps) ? set.targetReps.join('–') : set.targetReps ? String(set.targetReps) : '0'}
        onChange={(e) => updateSet(entryId, set.id, { reps: parseInt(e.target.value) || 0 })}
        className="cell"
      />
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="1"
        max="10"
        value={set.rpe ?? ''}
        placeholder="—"
        onChange={(e) => updateSet(entryId, set.id, { rpe: e.target.value ? parseFloat(e.target.value) : undefined })}
        className="cell"
      />
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => toggleComplete(entryId, set.id)}
          className="chamfer flex h-9 w-9 items-center justify-center border transition-all"
          style={{
            borderColor: set.completed ? 'var(--up)' : 'var(--line-strong)',
            background: set.completed ? 'rgba(56,247,176,0.18)' : 'transparent',
            color: set.completed ? 'var(--up)' : 'var(--ink-faint)',
            boxShadow: set.completed ? '0 0 12px rgba(56,247,176,0.4)' : 'none',
          }}
          aria-label="Toggle complete"
        >
          <IconCheck size={16} />
        </button>
      </div>
      <button
        onClick={() => removeSet(entryId, set.id)}
        className="flex h-8 w-full items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--down)]"
        aria-label="Delete set"
      >
        <IconTrash size={15} />
      </button>
    </div>
  );
}
