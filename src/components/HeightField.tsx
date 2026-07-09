import { Field, HudInput } from '@/components/hud';
import { cmToFtIn, ftInToCm, type Unit } from '@/lib/units';

/**
 * Height input that follows the user's unit preference: a single cm field
 * for metric users, feet + inches for pound users. Storage stays canonical
 * in cm; ft/in round-trips on whole inches.
 */
export function HeightField({
  heightCm,
  unit,
  onChange,
  hint,
}: {
  heightCm?: number;
  unit: Unit;
  onChange: (cm: number | undefined) => void;
  hint?: string;
}) {
  if (unit === 'kg') {
    return (
      <Field label="Height (cm)" hint={hint}>
        <HudInput
          type="number"
          inputMode="decimal"
          value={heightCm ?? ''}
          placeholder="175"
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
        />
      </Field>
    );
  }

  const { ft, inch } = heightCm ? cmToFtIn(heightCm) : { ft: undefined, inch: undefined };
  const set = (nextFt: number | undefined, nextIn: number | undefined) => {
    const f = nextFt ?? ft ?? 0;
    const i = nextIn ?? inch ?? 0;
    onChange(f || i ? ftInToCm(f, i) : undefined);
  };

  return (
    <Field label="Height (ft / in)" hint={hint}>
      <div className="flex gap-1.5">
        <HudInput
          type="number"
          inputMode="numeric"
          min={0}
          value={ft ?? ''}
          placeholder="5"
          aria-label="Height feet"
          onChange={(e) => set(Math.max(0, parseInt(e.target.value) || 0), undefined)}
        />
        <HudInput
          type="number"
          inputMode="numeric"
          min={0}
          max={11}
          value={inch ?? ''}
          placeholder="10"
          aria-label="Height inches"
          onChange={(e) => set(undefined, Math.min(11, Math.max(0, parseInt(e.target.value) || 0)))}
        />
      </div>
    </Field>
  );
}
