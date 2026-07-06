import { useMemo, useState } from 'react';
import { Chip, HudInput, Modal, Tag } from '@/components/hud';
import { MUSCLE_GROUPS, MUSCLE_LABEL, type MuscleGroup } from '@/data/muscles';
import { useExercises } from '@/hooks/useLive';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}

export function ExercisePicker({ open, onClose, onPick }: Props) {
  const exercises = useExercises();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return exercises
      .filter((e) => (query ? e.name.toLowerCase().includes(query) : true))
      .filter((e) =>
        muscle === 'all' ? true : e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 80);
  }, [exercises, q, muscle]);

  return (
    <Modal open={open} onClose={onClose} title="Add Exercise" wide>
      <HudInput placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip active={muscle === 'all'} onClick={() => setMuscle('all')}>
          All
        </Chip>
        {MUSCLE_GROUPS.map((m) => (
          <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
            {MUSCLE_LABEL[m]}
          </Chip>
        ))}
      </div>
      <div className="mt-3 max-h-[52vh] overflow-y-auto">
        <ul className="flex flex-col gap-1.5">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => {
                  onPick(e.id);
                  onClose();
                }}
                className="chamfer flex w-full items-center justify-between gap-2 border border-[var(--line)] bg-[rgba(120,200,255,0.03)] px-3 py-2.5 text-left transition-colors hover:border-[var(--cyan)] hover:bg-[rgba(56,225,255,0.06)]"
              >
                <span className="text-[13px] text-[var(--ink)]">{e.name}</span>
                <span className="flex items-center gap-1">
                  {e.primaryMuscles.slice(0, 2).map((m) => (
                    <Tag key={m}>{MUSCLE_LABEL[m]}</Tag>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
