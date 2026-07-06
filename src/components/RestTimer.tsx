import { HudButton, HudPanel, Readout } from '@/components/hud';
import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/lib/time';
import { useAppStore } from '@/store/useAppStore';

/** Rest timer bar. Uses a persisted end-timestamp so it survives reload/background. */
export function RestTimer() {
  const restEndsAt = useAppStore((s) => s.restEndsAt);
  const addRest = useAppStore((s) => s.addRest);
  const clearRest = useAppStore((s) => s.clearRest);
  const startRest = useAppStore((s) => s.startRest);
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {active ? (
            <>
              <HudButton variant="ghost" sheen={false} onClick={() => addRest(-15)} className="!min-h-[38px] !px-3">
                −15
              </HudButton>
              <HudButton variant="ghost" sheen={false} onClick={() => addRest(15)} className="!min-h-[38px] !px-3">
                +15
              </HudButton>
              <HudButton variant="danger" sheen={false} onClick={clearRest} className="!min-h-[38px] !px-3">
                Skip
              </HudButton>
            </>
          ) : (
            <>
              <HudButton variant="ghost" sheen={false} onClick={() => startRest(60)} className="!min-h-[38px] !px-3">
                1:00
              </HudButton>
              <HudButton variant="ghost" sheen={false} onClick={() => startRest(120)} className="!min-h-[38px] !px-3">
                2:00
              </HudButton>
              <HudButton variant="ghost" sheen={false} onClick={() => startRest(180)} className="!min-h-[38px] !px-3">
                3:00
              </HudButton>
            </>
          )}
        </div>
      </div>
      {active && (
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
      )}
    </HudPanel>
  );
}
