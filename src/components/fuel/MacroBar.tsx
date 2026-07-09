/** Progress toward one target; overshoot turns the bar red by default
 * (pass overColor for metrics where exceeding the goal is good, e.g. water). */
export function MacroBar({
  label,
  eaten,
  target,
  color,
  unit,
  overColor = 'var(--down)',
  compact = false,
}: {
  label: string;
  eaten: number;
  target: number;
  color: string;
  unit: string;
  overColor?: string;
  /** Hide the numeric readout — label + bar only (tight dashboard grids). */
  compact?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  const over = eaten > target && target > 0;
  const barColor = over ? overColor : color;
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-head text-[9px] tracking-[0.2em] text-[var(--ink-faint)]">{label}</span>
        {!compact && (
          <span className="mono text-[10px] text-[var(--ink-dim)]">
            {Math.round(eaten)} / {target} {unit}
          </span>
        )}
      </div>
      <div
        className="h-[6px] overflow-hidden rounded-full"
        style={{ background: 'rgba(120,200,255,0.08)', border: '1px solid var(--line)' }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(eaten)}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
        />
      </div>
    </div>
  );
}
