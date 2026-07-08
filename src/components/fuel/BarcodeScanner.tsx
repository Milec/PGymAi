import { useEffect, useRef, useState } from 'react';
import { HudButton, HudInput, Modal } from '@/components/hud';

/**
 * Camera barcode scanner for food logging. Uses the native BarcodeDetector
 * where available (Chrome/Android/Edge), falls back to a lazy-loaded ZXing
 * decoder elsewhere (iOS Safari, Firefox); manual entry always works.
 */

// Minimal typing for the (not-yet-standardised) BarcodeDetector API.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

interface Props {
  onClose: () => void;
  onDetected: (code: string) => void;
}

/** Mount fresh per scan session — the camera starts on mount, stops on unmount. */
export function BarcodeScanner({ onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  // Latch so a burst of detections only fires once.
  const firedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let zxingControls: { stop(): void } | null = null;

    const fire = (code: string) => {
      if (firedRef.current || cancelled) return;
      firedRef.current = true;
      onDetected(code.trim());
    };

    const start = async () => {
      if (!video) return;
      try {
        if (window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (cancelled) return;
          video.srcObject = stream;
          await video.play();
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          interval = setInterval(() => {
            void detector
              .detect(video)
              .then((codes) => {
                if (codes[0]?.rawValue) fire(codes[0].rawValue);
              })
              .catch(() => {});
          }, 250);
        } else {
          // ZXing manages its own camera stream; loaded on demand so the
          // decoder never weighs down the main bundle.
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            video,
            (result) => {
              if (result) fire(result.getText());
            },
          );
        }
      } catch (err) {
        if (cancelled) return;
        const denied = err instanceof DOMException && err.name === 'NotAllowedError';
        setError(
          denied
            ? 'Camera access was denied — you can still type the barcode below.'
            : 'Camera unavailable — you can still type the barcode below.',
        );
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [onDetected]);

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code) onDetected(code);
  };

  return (
    <Modal open onClose={onClose} title="SCAN BARCODE">
      <div
        className="chamfer relative mb-3 overflow-hidden"
        style={{ background: 'rgba(2,4,9,0.8)', border: '1px solid var(--line-strong)' }}
      >
        <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
        {/* Aiming reticle */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-1/2 h-16 -translate-y-1/2 rounded-[4px]"
          style={{ border: '1.5px solid var(--cyan)', boxShadow: '0 0 18px rgba(56,225,255,0.35)' }}
        />
      </div>
      {error && <p className="mb-3 text-[12px] text-[var(--amber)]">{error}</p>}
      {!error && (
        <p className="mb-3 text-[12px] text-[var(--ink-dim)]">
          Point the camera at the product barcode.
        </p>
      )}
      <div className="flex gap-2">
        <HudInput
          inputMode="numeric"
          placeholder="…or type the barcode"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitManual()}
        />
        <HudButton variant="ghost" sheen={false} onClick={submitManual} disabled={!manual.trim()}>
          Look up
        </HudButton>
      </div>
    </Modal>
  );
}
