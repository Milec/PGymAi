import { Link } from 'react-router-dom';
import { IconClock } from '@/components/icons';
import { useNow } from '@/hooks/useNow';
import { formatDuration } from '@/lib/time';
import { useAppStore } from '@/store/useAppStore';

export function WorkoutTimerBadge({ compact = false }: { compact?: boolean }) {
  const active = useAppStore((s) => s.active);
  const now = useNow();
  if (!active) {
    return compact ? null : (
      <div className="mono text-[10px] text-[var(--ink-faint)]">No active session</div>
    );
  }
  const elapsed = Math.floor((now - active.startedAt) / 1000);
  return (
    <Link
      to="/workout"
      className="chamfer flex items-center gap-2 border border-[var(--cyan)] px-3 py-2"
      style={{ background: 'rgba(56,225,255,0.08)', boxShadow: 'inset 0 0 12px rgba(56,225,255,0.2)' }}
    >
      <IconClock size={16} className="text-[var(--cyan)]" />
      <span className="mono text-sm font-semibold text-[var(--cyan)]">{formatDuration(elapsed)}</span>
      {!compact && <span className="font-head text-[9px] tracking-widest text-[var(--ink-dim)]">LIVE</span>}
    </Link>
  );
}
