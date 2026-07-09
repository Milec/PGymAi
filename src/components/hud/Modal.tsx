import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    // Lock background scroll while the modal is up (nested modals restore
    // the value they found, so the outermost close unlocks).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal to <body> so the overlay escapes any parent stacking context
  // (HudPanel wrappers use z-index) and truly covers the page.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'rgba(2,4,9,0.9)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <HudPanel
        className={`max-h-[90vh] w-full overflow-y-auto p-5 ${wide ? 'max-w-3xl' : 'max-w-md'}`}
        glow
        solid
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
    </div>,
    document.body,
  );
}
