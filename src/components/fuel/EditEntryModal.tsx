import { useState } from 'react';
import { Chip, HudButton, Modal, Tag } from '@/components/hud';
import type { FoodLogEntry } from '@/db/types';
import { removeLogEntry, updateLogEntry } from '@/lib/fuelLog';
import { MEALS, type MealId } from '@/lib/nutrition';
import { QuantityEditor } from './QuantityEditor';

interface Props {
  entry: FoodLogEntry | null;
  onClose: () => void;
}

/** Adjust or delete a journal entry (amount + meal). */
export function EditEntryModal({ entry, onClose }: Props) {
  if (!entry) return null;
  // Keyed remount resets the form state whenever a different entry opens.
  return <EditEntryInner key={entry.id} entry={entry} onClose={onClose} />;
}

function EditEntryInner({ entry, onClose }: { entry: FoodLogEntry; onClose: () => void }) {
  const [amountG, setAmountG] = useState(entry.amountG);
  const [meal, setMeal] = useState<MealId>(entry.meal);

  const save = async () => {
    await updateLogEntry(entry.id, { amountG, meal });
    onClose();
  };
  const remove = async () => {
    await removeLogEntry(entry.id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="EDIT ENTRY">
      <div className="mb-3">
        <div className="text-[15px] font-semibold text-[var(--ink)]">{entry.name}</div>
        {entry.brand && (
          <div className="mt-1">
            <Tag>{entry.brand}</Tag>
          </div>
        )}
      </div>
      <QuantityEditor
        per100={entry.per100}
        servingG={entry.servingG}
        amountG={amountG}
        onChange={setAmountG}
      />
      <div className="mt-4">
        <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">MEAL</div>
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <Chip key={m.id} active={meal === m.id} onClick={() => setMeal(m.id)} color="var(--amber)">
              {m.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <HudButton className="flex-1" onClick={() => void save()} disabled={amountG <= 0}>
          Save
        </HudButton>
        <HudButton variant="danger" sheen={false} onClick={() => void remove()}>
          Delete
        </HudButton>
      </div>
    </Modal>
  );
}
