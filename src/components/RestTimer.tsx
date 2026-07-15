import { HudButton, HudPanel, Readout } from '@/components/hud';
import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/lib/time';
import { useAppStore } from '@/store/useAppStore';

/** Shared control buttons — adjust an active rest, or start a preset. */
function RestControls({ active, size = 'md' }: { active: boolean; size?: 'sm' | 'md' }) {
  const addRest = useAppStore((s) => s.addRest);
  const clearRest = useAppStore((s) => s.clearRest);
  const startRest = useAppStore((s) => s.startRest);
  const btn = size === 'sm' ? '!min-h-[30px] !px-2 !text-[11px]' : '!min-h-[38px] !px-3';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {active ? (
        <>
          <HudButton variant="ghost" sheen={false} onClick={() => addRest(-15)} className={btn}>
            −15
          </HudButton>
          <HudButton variant="ghost" sheen={false} onClick={() => addRest(15)} className={btn}>
            +15
          </HudButton>
          <HudButton variant="danger" sheen={false} onClick={clearRest} className={btn}>
            Skip
          </HudButton>
        </>
      ) : (
        <>
          <HudButton variant="ghost" sheen={false} onClick={() => startRest(60)} className={btn}>
            1:00
          </HudButton>
          <HudButton variant="ghost" sheen={false} onClick={() => startRest(120)} className={btn}>
            2:00
          </HudButton>
          <HudButton variant="ghost" sheen={false} onClick={() => startRest(180)} className={btn}>
            3:00
          </HudButton>
        </>
      )}
    </div>
  );
}

/** Rest timer bar. Uses a persisted end-timestamp so it survives reload/background. */
export function RestTimer() {
  const restEndsAt = useAppStore((s) => s.restEndsAt);
  const now = useNow();

  const remaining = restEndsAt ? Math.max(0, Math.round((restEndsAt - now) / 1000)) : 0;
  const active = !!restEndsAt && remaining > 0;

  return (
    <HudPanel className="p-3" bracketColor={active ? 'var(--amber)' : 'var(--cyan)'} glow={active}>
      <div className="flex items-center justify-between gap-3">
        <Readout
          label="Rest Timer"
          value={formatClock(remaining)}
          size="lg"
          color={active ? 'var(--amber)' : 'var(--ink-dim)'}
          flash={false}
        />
        <RestControls active={active} />
      </div>
      {active && <RestProgress remaining={remaining} />}
    </HudPanel>
  );
}

function RestProgress({ remaining }: { remaining: number }) {
  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[rgba(120,200,255,0.1)]">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-linear"
        style={{
          width: `${Math.min(100, (remaining / (useAppStore.getState().restDurationSec || remaining || 1)) * 100)}%`,
          background: 'linear-gradient(90deg, var(--amber), var(--cyan))',
          boxShadow: '0 0 10px var(--amber)',
        }}
      />
    </div>
  );
}

/**
 * Condensed rest timer that lives in the top banner. Renders only once the
 * inline timer has scrolled out of view (`restDocked`) and a rest is running,
 * so an active countdown is always in reach.
 */
export function DockedRestTimer() {
  const restEndsAt = useAppStore((s) => s.restEndsAt);
  const restDocked = useAppStore((s) => s.restDocked);
  const now = useNow();

  const remaining = restEndsAt ? Math.max(0, Math.round((restEndsAt - now) / 1000)) : 0;
  const active = !!restEndsAt && remaining > 0;
  if (!restDocked || !active) return null;

  return (
    <div
      className="mt-2 flex items-center justify-between gap-3 rounded-[3px] border border-[var(--amber)]/50 px-2.5 py-1.5"
      style={{ background: 'rgba(255,193,74,0.08)', boxShadow: 'inset 0 0 14px rgba(255,193,74,0.12)' }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-head text-[8px] tracking-widest text-[var(--ink-faint)]">REST</span>
        <span className="mono text-lg font-semibold leading-none text-[var(--amber)]">
          {formatClock(remaining)}
        </span>
      </div>
      <RestControls active={active} size="sm" />
    </div>
  );
}
