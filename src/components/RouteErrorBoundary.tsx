import { Component, type ReactNode } from 'react';
import { HudButton } from '@/components/hud';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Catches render/lazy-load errors for a route so a failed dynamic import shows a
 * recoverable message instead of a blank screen. Reset it on navigation by
 * giving it a `key` that changes with the route.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="font-head tracking-[0.2em] text-[var(--down)]">FAILED TO LOAD</span>
        <p className="max-w-xs text-[12px] leading-relaxed text-[var(--ink-dim)]">
          This screen couldn't load — usually a stale cache after an update. Reload to fetch the
          latest version.
        </p>
        <HudButton onClick={() => window.location.reload()}>Reload</HudButton>
      </div>
    );
  }
}
