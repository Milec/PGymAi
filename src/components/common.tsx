import type { ReactNode } from 'react';
import { HudPanel } from '@/components/hud';

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1
          className="text-xl font-black tracking-[0.18em] text-[var(--ink)] md:text-2xl"
          style={{ textShadow: '0 0 16px rgba(56,225,255,0.35)' }}
        >
          {title}
        </h1>
        {sub && <p className="mt-1 text-[12px] text-[var(--ink-dim)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <HudPanel className="p-8 text-center" bracketColor="var(--violet)">
      <div className="font-head mb-2 text-sm tracking-[0.2em] text-[var(--violet)]">{title}</div>
      <div className="mx-auto max-w-sm text-[13px] leading-relaxed text-[var(--ink-dim)]">
        {children}
      </div>
    </HudPanel>
  );
}

export function StatTile({
  label,
  value,
  unit,
  color = 'var(--cyan)',
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <HudPanel className="p-4" bracketColor={color}>
      <div className="flex items-start justify-between">
        <span className="font-head text-[9px] tracking-[0.2em] text-[var(--ink-faint)]">{label}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="mono text-2xl font-semibold" style={{ color }}>
          {value}
        </span>
        {unit && <span className="mono text-[11px] text-[var(--ink-dim)]">{unit}</span>}
      </div>
    </HudPanel>
  );
}
