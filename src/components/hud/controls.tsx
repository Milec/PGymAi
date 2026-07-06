import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-head text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--ink-faint)]">{hint}</span>}
    </label>
  );
}

const inputBase =
  'mono w-full min-h-[42px] rounded-[3px] border border-[var(--line-strong)] bg-[rgba(5,9,20,0.6)] px-3 text-[var(--ink)] outline-none transition-colors focus:border-[var(--cyan)] focus:shadow-[0_0_12px_rgba(56,225,255,0.25)] placeholder:text-[var(--ink-faint)]';

export function HudInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function HudSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputBase} cursor-pointer appearance-none ${props.className ?? ''}`}
    />
  );
}

export function Chip({
  active,
  children,
  onClick,
  color = 'var(--cyan)',
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="font-head min-h-[34px] whitespace-nowrap rounded-full px-3 text-[10px] tracking-[0.14em] transition-all"
      style={{
        color: active ? 'var(--space-0)' : 'var(--ink-dim)',
        background: active ? color : 'rgba(120,200,255,0.06)',
        border: `1px solid ${active ? color : 'var(--line)'}`,
        boxShadow: active ? `0 0 12px ${color}66` : 'none',
      }}
    >
      {children}
    </button>
  );
}

export function Tag({ children, color = 'var(--ink-dim)' }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="mono rounded-[2px] px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
      style={{ color, background: 'rgba(120,200,255,0.06)', border: '1px solid var(--line)' }}
    >
      {children}
    </span>
  );
}

export function Delta({ value, unit = '' }: { value: number; unit?: string }) {
  const up = value >= 0;
  return (
    <span
      className="mono inline-flex items-center gap-0.5 text-sm font-semibold"
      style={{ color: up ? 'var(--up)' : 'var(--down)' }}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}
      {unit}
    </span>
  );
}
