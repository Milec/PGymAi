import { useMemo, useState } from 'react';
import { PageTitle } from '@/components/common';
import { Chip, Field, HudButton, HudInput, HudPanel, HudSelect, Modal, Tag } from '@/components/hud';
import { IconPlus } from '@/components/icons';
import { persistCustomExercise } from '@/sync/local';
import { formatWeight, toKg } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  MUSCLE_LABEL,
  PATTERNS,
  type Equipment,
  type MovementPattern,
  type MuscleGroup,
} from '@/data/muscles';
import { useExercises } from '@/hooks/useLive';
import type { Exercise } from '@/db/types';
import { hasStandard } from '@/data/strengthStandards';

export function LibraryPage() {
  const exercises = useExercises();
  const profile = useAppStore((s) => s.profile);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [equip, setEquip] = useState<Equipment | 'all'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [prFor, setPrFor] = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return exercises
      .filter((e) => (query ? e.name.toLowerCase().includes(query) : true))
      .filter((e) =>
        muscle === 'all'
          ? true
          : e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle),
      )
      .filter((e) => (equip === 'all' ? true : e.equipment === equip))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, q, muscle, equip]);

  return (
    <div>
      <PageTitle
        title="Exercise Library"
        sub={`${exercises.length} exercises loaded — search, filter, or add your own.`}
        right={
          <HudButton variant="accent" onClick={() => setAddOpen(true)}>
            <IconPlus size={16} /> Custom
          </HudButton>
        }
      />

      <HudPanel className="mb-4 p-4">
        <HudInput
          placeholder="Search exercises…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Chip active={muscle === 'all'} onClick={() => setMuscle('all')}>
            All Muscles
          </Chip>
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABEL[m]}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <Chip active={equip === 'all'} onClick={() => setEquip('all')} color="var(--violet)">
            All Gear
          </Chip>
          {EQUIPMENT.map((eq) => (
            <Chip key={eq} active={equip === eq} onClick={() => setEquip(eq)} color="var(--violet)">
              {eq}
            </Chip>
          ))}
        </div>
      </HudPanel>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => (
          <HudPanel key={e.id} className="p-3.5" brackets={false}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-[14px] font-medium text-[var(--ink)]">{e.name}</div>
              {e.bigLift && hasStandard(e.standardKey) && (
                <span className="font-head shrink-0 rounded-[2px] border border-[var(--amber)] px-1.5 py-0.5 text-[8px] tracking-widest text-[var(--amber)]">
                  BIG LIFT
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {e.primaryMuscles.map((m) => (
                <Tag key={m} color="var(--cyan)">
                  {MUSCLE_LABEL[m]}
                </Tag>
              ))}
              {e.secondaryMuscles.map((m) => (
                <Tag key={m}>{MUSCLE_LABEL[m]}</Tag>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--ink-faint)]">
              <span className="mono uppercase">{e.equipment}</span>
              <span>·</span>
              <span className="mono uppercase">{e.pattern.replace('-', ' ')}</span>
              <span>·</span>
              <span className="mono uppercase">{e.category}</span>
              {e.custom && (
                <span className="font-head ml-auto text-[8px] tracking-widest text-[var(--violet)]">
                  CUSTOM
                </span>
              )}
            </div>
            <button
              onClick={() => setPrFor(e)}
              className="mono mt-3 flex w-full items-center justify-between rounded-[3px] border border-[var(--line)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--amber)]"
            >
              <span className="font-head text-[9px] tracking-widest text-[var(--ink-faint)]">1RM PR</span>
              {profile.prs?.[e.id] ? (
                <span className="font-semibold text-[var(--amber)]">
                  {formatWeight(profile.prs[e.id], profile.units)} {profile.units}
                </span>
              ) : (
                <span className="text-[var(--cyan)]">+ Set</span>
              )}
            </button>
          </HudPanel>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-10 text-center text-[13px] text-[var(--ink-faint)]">
            No exercises match your filters.
          </div>
        )}
      </div>

      <AddExerciseModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PrModal exercise={prFor} onClose={() => setPrFor(null)} />
    </div>
  );
}

function PrModal({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const profile = useAppStore((s) => s.profile);
  const setPr = useAppStore((s) => s.setPr);
  const unit = profile.units;
  const current = exercise ? profile.prs?.[exercise.id] : undefined;
  const [val, setVal] = useState('');

  // Sync the input with the selected exercise each time the modal opens.
  const [lastId, setLastId] = useState<string | null>(null);
  if (exercise && exercise.id !== lastId) {
    setLastId(exercise.id);
    setVal(current ? formatWeight(current, unit) : '');
  }

  if (!exercise) return null;
  const save = async () => {
    const v = parseFloat(val);
    await setPr(exercise.id, Number.isNaN(v) || v <= 0 ? null : toKg(v, unit));
    onClose();
  };

  return (
    <Modal open={!!exercise} onClose={onClose} title={`${exercise.name} — 1RM PR`}>
      <div className="flex flex-col gap-3">
        <p className="text-[12px] leading-relaxed text-[var(--ink-dim)]">
          Enter your best (or estimated) one-rep max. STRIDE uses it to auto-fill working weights
          from a %1RM or RPE target when you log this lift.
        </p>
        <Field label={`1RM (${unit})`}>
          <HudInput
            type="number"
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 140"
            autoFocus
          />
        </Field>
        <div className="mt-1 flex justify-between gap-2">
          <HudButton variant="danger" sheen={false} onClick={() => void setPr(exercise.id, null).then(onClose)}>
            Clear
          </HudButton>
          <div className="flex gap-2">
            <HudButton variant="ghost" sheen={false} onClick={onClose}>
              Cancel
            </HudButton>
            <HudButton variant="accent" onClick={save}>
              Save PR
            </HudButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AddExerciseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [pattern, setPattern] = useState<MovementPattern>('horizontal-push');
  const [category, setCategory] = useState<'compound' | 'isolation'>('compound');

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ex: Exercise = {
      id: 'custom-' + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36),
      name: trimmed,
      primaryMuscles: [primary],
      secondaryMuscles: [],
      equipment,
      pattern,
      category,
      bigLift: false,
      custom: true,
    };
    await persistCustomExercise(ex);
    setName('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Custom Exercise">
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <HudInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cable Y-Raise" />
        </Field>
        <Field label="Primary Muscle">
          <HudSelect value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </HudSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Equipment">
            <HudSelect value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {EQUIPMENT.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </HudSelect>
          </Field>
          <Field label="Pattern">
            <HudSelect value={pattern} onChange={(e) => setPattern(e.target.value as MovementPattern)}>
              {PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </HudSelect>
          </Field>
        </div>
        <Field label="Category">
          <HudSelect value={category} onChange={(e) => setCategory(e.target.value as 'compound' | 'isolation')}>
            <option value="compound">compound</option>
            <option value="isolation">isolation</option>
          </HudSelect>
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <HudButton variant="ghost" onClick={onClose}>
            Cancel
          </HudButton>
          <HudButton onClick={save}>Save</HudButton>
        </div>
      </div>
    </Modal>
  );
}
