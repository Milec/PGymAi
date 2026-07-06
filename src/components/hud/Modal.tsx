import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { HudPanel } from './HudPanel';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'rgba(3,5,11,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <HudPanel
        className={`max-h-[90vh] w-full overflow-y-auto p-5 ${wide ? 'max-w-3xl' : 'max-w-md'}`}
        glow
      >
        <div onClick={(e) => e.stopPropagation()}>
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm text-[var(--cyan)]">{title}</h3>
              <button
                onClick={onClose}
                className="mono flex h-8 w-8 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--cyan)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}
          {children}
        </div>
      </HudPanel>
    </div>
  );
}
