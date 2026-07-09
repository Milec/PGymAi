import { useEffect, useRef, useState } from 'react';
import { HudButton, HudInput, Modal } from '@/components/hud';

/**
 * Camera barcode scanner for food logging. Prefers the native BarcodeDetector
 * only when it actually supports retail barcode formats (some browsers expose
 * the API with zero supported formats); otherwise lazy-loads the ZXing
 * decoder (iOS Safari, Firefox, desktop Chrome without shape detection).
 * Manual entry always works.
 *
 * Feedback model: while searching, a sweep line animates inside the aiming
 * reticle; the moment a barcode is seen, a lock-on box snaps to the code's
 * actual position/size (live-tracked on the native path), turns green, and
 * the lookup fires after a short confirmation flash.
 */

// Minimal typing for the (not-yet-standardised) BarcodeDetector API.
interface DetectedBarcode {
  rawValue: string;
  boundingBox?: DOMRectReadOnly;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
/** Consecutive native detections required before accepting (misread guard). */
const CONFIRM_HITS = 2;
/** How long the green lock-on flash shows before the lookup fires. */
const LOCK_FLASH_MS = 350;

/** Higher-resolution frames dramatically improve decode rates on phones. */
const CAMERA: MediaStreamConstraints = {
  video: {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

/** Native detection is only trustworthy if it really decodes EAN barcodes. */
async function nativeBarcodeSupport(): Promise<boolean> {
  try {
    const ctor = window.BarcodeDetector;
    if (!ctor?.getSupportedFormats) return false;
    const formats = await ctor.getSupportedFormats();
    return formats.includes('ean_13');
  } catch {
    return false;
  }
}

interface LockBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Map a rect in raw video-frame coordinates onto the displayed element.
 * The <video> uses object-cover, so the frame is scaled to fill and cropped.
 */
function mapFrameRect(
  video: HTMLVideoElement,
  r: { x: number; y: number; width: number; height: number },
): LockBox | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.max(video.clientWidth / vw, video.clientHeight / vh);
  const ox = (video.clientWidth - vw * scale) / 2;
  const oy = (video.clientHeight - vh * scale) / 2;
  return { x: r.x * scale + ox, y: r.y * scale + oy, w: r.width * scale, h: r.height * scale };
}

interface Props {
  onClose: () => void;
  onDetected: (code: string) => void;
}

/** Mount fresh per scan session — the camera starts on mount, stops on unmount. */
export function BarcodeScanner({ onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'locked' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<LockBox | null>(null);
  const [manual, setManual] = useState('');
  // Latch so a burst of detections only fires once; ref keeps the effect
  // mount-stable so parent re-renders never restart the camera.
  const firedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    let zxingControls: { stop(): void } | null = null;

    const fire = (code: string) => {
      if (firedRef.current || cancelled) return;
      firedRef.current = true;
      onDetectedRef.current(code.trim());
    };

    /** Show the green lock-on flash, then fire after a beat. */
    const lockOn = (code: string, box: LockBox | null) => {
      if (firedRef.current || cancelled) return;
      if (interval) clearInterval(interval);
      zxingControls?.stop();
      setLock(box);
      setStatus('locked');
      flashTimer = setTimeout(() => fire(code), LOCK_FLASH_MS);
    };

    const fail = (message: string) => {
      if (cancelled) return;
      setStatus('error');
      setError(message);
    };

    const start = async () => {
      if (!video) return;
      try {
        if (await nativeBarcodeSupport()) {
          stream = await navigator.mediaDevices.getUserMedia(CAMERA);
          if (cancelled) return;
          video.srcObject = stream;
          await video.play();
          if (cancelled) return;
          setStatus('scanning');
          const detector = new window.BarcodeDetector!({ formats: FORMATS });
          // Track the code across polls: the box follows the barcode live and
          // only a repeat sighting of the same value locks on.
          let hits = 0;
          let lastValue = '';
          interval = setInterval(() => {
            void detector
              .detect(video)
              .then((codes) => {
                const hit = codes[0];
                if (!hit?.rawValue) {
                  hits = 0;
                  setLock(null);
                  return;
                }
                const box = hit.boundingBox ? mapFrameRect(video, hit.boundingBox) : null;
                setLock(box);
                hits = hit.rawValue === lastValue ? hits + 1 : 1;
                lastValue = hit.rawValue;
                if (hits >= CONFIRM_HITS) lockOn(hit.rawValue, box);
              })
              .catch(() => {});
          }, 160);
        } else {
          // ZXing manages its own camera stream; loaded on demand so the
          // decoder never weighs down the main bundle.
          let BrowserMultiFormatReader;
          try {
            ({ BrowserMultiFormatReader } = await import('@zxing/browser'));
          } catch {
            fail('Scanner module failed to load — check your connection, or type the barcode below.');
            return;
          }
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints(CAMERA, video, (result) => {
            if (!result || firedRef.current) return;
            // ZXing only reports on a successful decode — build the lock box
            // from its result points (they lie along the scan line).
            let box: LockBox | null = null;
            const pts = result.getResultPoints?.() ?? [];
            if (pts.length >= 2 && video.videoWidth) {
              const xs = pts.map((p) => p.getX());
              const ys = pts.map((p) => p.getY());
              const pad = video.videoHeight * 0.06;
              box = mapFrameRect(video, {
                x: Math.min(...xs) - pad / 2,
                y: Math.min(...ys) - pad,
                width: Math.max(...xs) - Math.min(...xs) + pad,
                height: Math.max(...ys) - Math.min(...ys) + pad * 2,
              });
            }
            lockOn(result.getText(), box);
          });
          if (cancelled) zxingControls.stop();
          else setStatus('scanning');
        }
      } catch (err) {
        const denied =
          err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
        fail(
          denied
            ? 'Camera access was denied — allow it in your browser/app settings, or type the barcode below.'
            : 'Camera unavailable — you can still type the barcode below.',
        );
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (flashTimer) clearTimeout(flashTimer);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, []);

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code) onDetected(code);
  };

  const locked = status === 'locked';

  return (
    <Modal open onClose={onClose} title="SCAN BARCODE">
      <div
        className="chamfer relative mb-3 overflow-hidden"
        style={{ background: 'rgba(2,4,9,0.8)', border: '1px solid var(--line-strong)' }}
      >
        <video ref={videoRef} className="h-56 w-full object-cover" autoPlay muted playsInline />

        {/* Searching: aiming reticle + animated sweep line. Hidden once the
            code is sighted — the lock-on box takes over. */}
        {!lock && status !== 'error' && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-1/2 h-16 -translate-y-1/2 overflow-hidden rounded-[4px]"
            style={{ border: '1.5px solid var(--cyan)', boxShadow: '0 0 18px rgba(56,225,255,0.35)' }}
          >
            {status === 'scanning' && (
              <div
                className="absolute inset-x-1 h-[2px]"
                style={{
                  background: 'linear-gradient(90deg, transparent, var(--cyan), transparent)',
                  boxShadow: '0 0 10px var(--cyan)',
                  animation: 'scan-sweep 1.1s ease-in-out infinite alternate',
                }}
              />
            )}
          </div>
        )}

        {/* Lock-on box: sized and positioned around the detected barcode.
            Cyan while confirming, green once locked. */}
        {lock && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-[4px] transition-all duration-150"
            style={{
              left: lock.x,
              top: lock.y,
              width: lock.w,
              height: lock.h,
              border: `2px solid ${locked ? 'var(--up)' : 'var(--cyan)'}`,
              boxShadow: locked
                ? '0 0 22px rgba(56,247,176,0.65), inset 0 0 14px rgba(56,247,176,0.25)'
                : '0 0 16px rgba(56,225,255,0.5)',
            }}
          />
        )}

        {status !== 'error' && (
          <span
            className="font-head absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] tracking-[0.22em]"
            style={{
              color: locked ? 'var(--up)' : 'var(--cyan)',
              textShadow: locked ? '0 0 8px rgba(56,247,176,0.7)' : '0 0 8px rgba(56,225,255,0.6)',
            }}
          >
            {status === 'starting' ? 'STARTING CAMERA…' : locked ? 'LOCKED' : lock ? 'READING…' : 'SCANNING…'}
          </span>
        )}
      </div>
      {error && <p className="mb-3 text-[12px] text-[var(--amber)]">{error}</p>}
      {!error && (
        <p className="mb-3 text-[12px] text-[var(--ink-dim)]">
          Point the camera at the product barcode and hold steady.
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
