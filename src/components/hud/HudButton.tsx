import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'accent';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  /** Enable animated sheen sweep on hover. */
  sheen?: boolean;
}

const palette: Record<Variant, { fg: string; border: string; glow: string; bg: string }> = {
  primary: { fg: 'var(--cyan)', border: 'var(--cyan)', glow: 'rgba(56,225,255,0.35)', bg: 'rgba(56,225,255,0.10)' },
  accent: { fg: 'var(--amber)', border: 'var(--amber)', glow: 'rgba(255,176,32,0.35)', bg: 'rgba(255,176,32,0.10)' },
  danger: { fg: 'var(--down)', border: 'var(--down)', glow: 'rgba(255,90,114,0.35)', bg: 'rgba(255,90,114,0.10)' },
  ghost: { fg: 'var(--ink-dim)', border: 'var(--line-strong)', glow: 'rgba(120,200,255,0.15)', bg: 'transparent' },
};

/** HUD action button: chamfered, glowing, with a sheen sweep. */
export function HudButton({ children, variant = 'primary', sheen = true, className = '', style, ...rest }: Props) {
  const p = palette[variant];
  return (
    <button
      {...rest}
      className={`chamfer group font-head relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden px-4 text-[12px] tracking-[0.14em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{
        color: p.fg,
        border: `1px solid ${p.border}`,
        background: p.bg,
        boxShadow: `0 0 0 rgba(0,0,0,0), inset 0 0 12px ${p.glow}`,
        ...style,
      }}
    >
      {sheen && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-0 group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            animation: 'sheen 1.4s ease-in-out infinite',
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
