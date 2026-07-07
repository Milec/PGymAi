import type { ReactNode } from 'react';
import { CornerBrackets } from './CornerBrackets';

interface Props {
  children: ReactNode;
  className?: string;
  /** Show glowing corner brackets. */
  brackets?: boolean;
  bracketColor?: string;
  /** Optional HUD-style label rendered on the top edge. */
  label?: string;
  as?: 'div' | 'section' | 'article';
  glow?: boolean;
  /** Use an opaque background instead of translucent glass (e.g. modals). */
  solid?: boolean;
}

/**
 * Frosted-glass, chamfered panel — the core HUD surface.
 * The chamfered glass is a separate absolutely-positioned layer so the label
 * and corner brackets (on the rectangular bounding box) are never clipped.
 */
export function HudPanel({
  children,
  className = '',
  brackets = true,
  bracketColor,
  label,
  as: Tag = 'div',
  glow = false,
  solid = false,
}: Props) {
  return (
    <Tag
      className={`relative ${className}`}
      style={solid ? { background: 'var(--space-1)', borderRadius: 'var(--radius)' } : undefined}
    >
      <div
        aria-hidden
        className="chamfer absolute inset-0"
        style={{
          background: solid ? 'var(--space-1)' : 'var(--glass)',
          backdropFilter: solid ? undefined : 'blur(var(--panel-blur))',
          WebkitBackdropFilter: solid ? undefined : 'blur(var(--panel-blur))',
          border: '1px solid var(--line)',
          boxShadow: glow
            ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px rgba(56,225,255,0.12)'
            : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      />
      {brackets && <CornerBrackets color={bracketColor} />}
      {label && (
        <div
          className="font-head absolute -top-[8px] left-5 z-10 px-2 text-[10px] tracking-[0.22em] text-[var(--cyan)]"
          style={{ background: 'var(--space-1)', textShadow: '0 0 8px rgba(56,225,255,0.6)' }}
        >
          {label}
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </Tag>
  );
}
