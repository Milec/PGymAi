import { Chip, HudInput } from '@/components/hud';
import { macrosForAmount, type MacroSet } from '@/lib/nutrition';

/**
 * Amount picker + live macro preview for a food. Amounts are grams
 * (canonical); when the product declares a serving size, serving chips
 * offer one-tap multiples.
 */

export function fmtG(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

interface Props {
  per100: MacroSet;
  servingG?: number;
  amountG: number;
  onChange: (amountG: number) => void;
}

export function QuantityEditor({ per100, servingG, amountG, onChange }: Props) {
  const macros = macrosForAmount(per100, amountG);
  const servings = servingG ? amountG / servingG : null;

  return (
    <div>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-head text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
            AMOUNT (G)
          </span>
          <HudInput
            type="number"
            inputMode="decimal"
            min={0}
            value={amountG || ''}
            onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="100"
          />
        </label>
        {servings !== null && (
          <span className="mono pb-3 text-[11px] text-[var(--ink-dim)]">
            = {fmtG(Math.round(servings * 10) / 10)} serving{servings === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {servingG
          ? [0.5, 1, 1.5, 2].map((s) => (
              <Chip
                key={s}
                active={Math.abs(amountG - s * servingG) < 0.01}
                onClick={() => onChange(Math.round(s * servingG * 10) / 10)}
              >
                {s} × {fmtG(servingG)}g
              </Chip>
            ))
          : [50, 100, 150, 200].map((g) => (
              <Chip key={g} active={amountG === g} onClick={() => onChange(g)}>
                {g}g
              </Chip>
            ))}
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
