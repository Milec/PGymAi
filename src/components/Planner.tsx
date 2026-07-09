import { useState } from 'react';
import { ExercisePicker } from '@/components/ExercisePicker';
import { Field, HudButton, HudInput, HudPanel, Modal, Tag } from '@/components/hud';
import { IconLift, IconPlus, IconProgram, IconTrash } from '@/components/icons';
import type { PlannedExercise, Workout, WorkoutPlan } from '@/db/types';
import { useExerciseMap, usePlans } from '@/hooks/useLive';
import { uid } from '@/lib/id';
import { formatWeight, toKg } from '@/lib/units';
import { persistPlan, removePlan } from '@/sync/local';
import { useAppStore } from '@/store/useAppStore';

/**
 * Workout planner: build a session before training, save it as a named plan,
 * and launch it later — sets are pre-created with target reps/weight.
 */

/** Materialise a plan into a ready-to-log workout. */
export function workoutFromPlan(plan: WorkoutPlan, bodyweightKg: number): Workout {
  return {
    id: uid('wk'),
    startedAt: Date.now(),
    title: plan.name,
    entries: plan.exercises.map((pe) => ({
      id: uid('en'),
      exerciseId: pe.exerciseId,
      sets: Array.from({ length: Math.max(1, pe.sets) }, () => ({
        id: uid('set'),
        weightKg: pe.weightKg ?? 0,
        reps: 0,
        completed: false,
        targetReps: pe.reps,
      })),
    })),
    bodyweightKgAtTime: bodyweightKg,
  };
}

export function PlannerPanel() {
  const plans = usePlans();
  const exMap = useExerciseMap();
  const profile = useAppStore((s) => s.profile);
  const startSession = useAppStore((s) => s.startSession);
  const [editing, setEditing] = useState<WorkoutPlan | 'new' | null>(null);

  const start = (plan: WorkoutPlan) => {
    if (startSession(workoutFromPlan(plan, profile.bodyweightKg))) {
      void persistPlan({ ...plan, lastUsedAt: Date.now() });
    }
  };

  const del = async (plan: WorkoutPlan) => {
    if (confirm(`Delete the plan “${plan.name}”?`)) await removePlan(plan.id);
  };

  return (
    <HudPanel className="p-5" label="PLANNER" bracketColor="var(--violet)">
      <p className="mb-3 text-[12px] leading-relaxed text-[var(--ink-dim)]">
        Build a workout before you train — exercises, sets, target reps &amp; weight — then save
        it and launch it any day.
      </p>

      {plans.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {plans.map((plan) => {
            const totalSets = plan.exercises.reduce((n, e) => n + e.sets, 0);
            return (
              <div
                key={plan.id}
                className="chamfer flex flex-wrap items-center justify-between gap-2 border border-[var(--line)] px-3 py-2.5"
                style={{ background: 'rgba(120,200,255,0.04)' }}
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[var(--ink)]">{plan.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]">
                    {plan.exercises.length} exercise{plan.exercises.length === 1 ? '' : 's'} ·{' '}
                    {totalSets} sets ·{' '}
                    {plan.exercises
                      .slice(0, 3)
                      .map((e) => exMap.get(e.exerciseId)?.name ?? e.exerciseId)
                      .join(', ')}
                    {plan.exercises.length > 3 ? '…' : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <HudButton className="!min-h-[36px] !px-3 !text-[10px]" onClick={() => start(plan)}>
                    <IconLift size={13} /> Start
                  </HudButton>
                  <HudButton
                    variant="ghost"
                    sheen={false}
                    className="!min-h-[36px] !px-3 !text-[10px]"
                    onClick={() => setEditing(plan)}
                  >
                    Edit
                  </HudButton>
                  <button
                    onClick={() => void del(plan)}
                    className="flex h-9 w-9 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--down)]"
                    aria-label={`Delete plan ${plan.name}`}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HudButton variant="ghost" className="w-full" onClick={() => setEditing('new')}>
        <IconProgram size={15} /> New Plan
      </HudButton>

      {editing && (
        <PlanEditorModal plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </HudPanel>
  );
}

// ---------------------------------------------------------------------------

function PlanEditorModal({ plan, onClose }: { plan: WorkoutPlan | null; onClose: () => void }) {
  const exMap = useExerciseMap();
  const unit = useAppStore((s) => s.profile.units);
  const [name, setName] = useState(plan?.name ?? '');
  const [rows, setRows] = useState<PlannedExercise[]>(plan?.exercises ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const patchRow = (id: string, patch: Partial<PlannedExercise>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const move = (index: number, delta: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      const j = index + delta;
      if (j < 0 || j >= next.length) return rs;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const valid = name.trim().length > 0 && rows.length > 0;

  const save = async () => {
    if (!valid) return;
    await persistPlan({
      id: plan?.id ?? uid('plan'),
      name: name.trim(),
      exercises: rows,
      createdAt: plan?.createdAt ?? Date.now(),
      lastUsedAt: plan?.lastUsedAt,
    });
    onClose();
  };

  return (
    <>
    <Modal open={!pickerOpen} onClose={onClose} title={plan ? 'EDIT PLAN' : 'NEW PLAN'} wide>
      <Field label="Plan name">
        <HudInput
          autoFocus={!plan}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day A"
        />
      </Field>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((row, i) => {
          const ex = exMap.get(row.exerciseId);
          return (
            <div key={row.id} className="rounded-[3px] border border-[var(--line)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="mono text-[10px] text-[var(--ink-faint)]">{i + 1}</span>
                  <span className="truncate text-[13px] font-semibold text-[var(--ink)]">
                    {ex?.name ?? row.exerciseId}
                  </span>
                  {ex && <Tag color="var(--cyan)">{ex.primaryMuscles[0]}</Tag>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="mono h-8 w-7 text-[var(--ink-faint)] transition-colors hover:text-[var(--cyan)] disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    className="mono h-8 w-7 text-[var(--ink-faint)] transition-colors hover:text-[var(--cyan)] disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                    className="flex h-8 w-8 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--down)]"
                    aria-label="Remove exercise"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Sets">
                  <HudInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={row.sets || ''}
                    onChange={(e) => patchRow(row.id, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </Field>
                <Field label="Target reps">
                  <HudInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={row.reps ?? ''}
                    placeholder="—"
                    onChange={(e) =>
                      patchRow(row.id, { reps: e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : undefined })
                    }
                  />
                </Field>
                <Field label={`Weight (${unit})`}>
                  <HudInput
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={row.weightKg ? formatWeight(row.weightKg, unit) : ''}
                    placeholder="—"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      patchRow(row.id, { weightKg: v > 0 ? toKg(v, unit) : undefined });
                    }}
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="mt-3 text-[12px] text-[var(--ink-faint)]">
          Add at least one exercise to save this plan.
        </p>
      )}

      <HudButton variant="ghost" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>
        <IconPlus size={15} /> Add Exercise
      </HudButton>

      <div className="mt-4 flex gap-2">
        <HudButton className="flex-1" onClick={() => void save()} disabled={!valid}>
          Save Plan
        </HudButton>
        <HudButton variant="ghost" sheen={false} onClick={onClose}>
          Cancel
        </HudButton>
      </div>

    </Modal>
    <ExercisePicker
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onPick={(exerciseId) => setRows((rs) => [...rs, { id: uid('pe'), exerciseId, sets: 3 }])}
    />
    </>
  );
}
