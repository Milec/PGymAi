import { useState } from 'react';
import { Chip, HudInput, HudSelect } from '@/components/hud';
import { macrosForAmount, type MacroSet } from '@/lib/nutrition';

/**
 * MyFitnessPal-style amount picker: **number of servings × serving size**,
 * with a live macro preview. Serving sizes range from the product's labelled
 * serving down to exact grams (and oz). Storage stays canonical in grams —
 * the component reports every change as `amountG`.
 */

const OZ_G = 28.3495;

interface ServingUnit {
  id: string;
  label: string;
  grams: number;
}

function unitsFor(servingG?: number): ServingUnit[] {
  const units: ServingUnit[] = [];
  if (servingG) units.push({ id: 'serving', label: `serving (${fmtG(servingG)} g)`, grams: servingG });
  units.push({ id: '100g', label: '100 g', grams: 100 });
  units.push({ id: '1g', label: 'g', grams: 1 });
  units.push({ id: 'oz', label: 'oz (28.3 g)', grams: OZ_G });
  return units;
}

export function fmtG(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/** Compact number for the servings field: up to 2 decimals, no tail zeros. */
function fmtCount(n: number): string {
  return String(Math.round(n * 100) / 100);
}

interface Props {
  per100: MacroSet;
  servingG?: number;
  amountG: number;
  onChange: (amountG: number) => void;
}

export function QuantityEditor({ per100, servingG, amountG, onChange }: Props) {
  const units = unitsFor(servingG);
  const [unitId, setUnitId] = useState(units[0].id);
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  // Text state so decimals type naturally; grams derive from it.
  const [count, setCount] = useState(() => fmtCount(amountG / units[0].grams));

  const commit = (nextCount: string, nextUnit: ServingUnit) => {
    const n = Math.max(0, parseFloat(nextCount) || 0);
    onChange(Math.round(n * nextUnit.grams * 10) / 10);
  };

  const setServings = (c: string) => {
    setCount(c);
    commit(c, unit);
  };

  const setUnit = (id: string) => {
    // MFP behaviour: keep the servings count, re-derive the total.
    const next = units.find((u) => u.id === id) ?? units[0];
    setUnitId(id);
    commit(count, next);
  };

  const macros = macrosForAmount(per100, amountG);
  const numeric = parseFloat(count) || 0;

  return (
    <div>
      <div className="flex items-end gap-2">
        <label className="flex w-24 shrink-0 flex-col gap-1">
          <span className="font-head text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
            SERVINGS
          </span>
          <HudInput
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={count}
            onChange={(e) => setServings(e.target.value)}
            aria-label="Number of servings"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-head text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
            SERVING SIZE
          </span>
          <HudSelect
            value={unit.id}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Serving size"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </HudSelect>
        </label>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {[0.5, 1, 1.5, 2, 3].map((c) => (
          <Chip key={c} active={Math.abs(numeric - c) < 0.001} onClick={() => setServings(fmtCount(c))}>
            {fmtCount(c)}
          </Chip>
        ))}
        <span className="mono ml-auto text-[11px] text-[var(--ink-dim)]">
          = {fmtG(Math.round(amountG * 10) / 10)} g
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ['KCAL', macros.kcal, 'var(--amber)'],
            ['PROTEIN', macros.proteinG, 'var(--cyan)'],
            ['CARBS', macros.carbsG, 'var(--violet)'],
            ['FAT', macros.fatG, 'var(--ink)'],
          ] as const
        ).map(([label, v, color]) => (
          <div
            key={label}
            className="rounded-[3px] border border-[var(--line)] px-1 py-2"
            style={{ background: 'rgba(120,200,255,0.04)' }}
          >
            <div className="mono text-base font-semibold" style={{ color }}>
              {Math.round(v)}
            </div>
            <div className="font-head text-[8px] tracking-[0.16em] text-[var(--ink-faint)]">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
