import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string | number;
  label?: string;
  unit?: string;
  /** Glow-flash on increase/decrease. */
  flash?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

const sizes: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
};

/** Instrument-panel numeric readout: mono, tabular, glows green/red on change. */
export function Readout({ value, label, unit, flash = true, size = 'md', color = 'var(--ink)', className = '' }: Props) {
  const prev = useRef<number | null>(null);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (!flash || Number.isNaN(num)) {
      prev.current = num;
      return;
    }
    if (prev.current !== null && num !== prev.current) {
      setDir(num > prev.current ? 'up' : 'down');
      const t = setTimeout(() => setDir(null), 900);
      prev.current = num;
      return () => clearTimeout(t);
    }
    prev.current = num;
  }, [value, flash]);

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <span className="font-head text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
          {label}
        </span>
      )}
      <span className="flex items-baseline gap-1">
        <span
          className={`mono font-semibold leading-none ${sizes[size]} ${dir === 'up' ? 'flash-up' : dir === 'down' ? 'flash-down' : ''}`}
          style={{ color }}
        >
          {value}
        </span>
        {unit && <span className="mono text-xs text-[var(--ink-dim)]">{unit}</span>}
      </span>
    </div>
  );
}
