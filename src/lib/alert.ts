/**
 * The rest-timer alert: a short beep plus a vibration pulse when a rest ends.
 *
 * Synthesised with WebAudio rather than shipped as an audio file — it costs no
 * bytes in the precache and works offline by construction. Everything here is
 * best-effort: a browser with no WebAudio, no vibration motor, or a locked
 * AudioContext must degrade to silence, never to an exception in a timer.
 */

type AudioCtor = typeof AudioContext;

function audioCtor(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as Window & { webkitAudioContext?: AudioCtor };
  return window.AudioContext ?? w.webkitAudioContext;
}

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = audioCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Nudge the AudioContext awake. Browsers only allow audio to start from a user
 * gesture, so this is called from the tap that begins a rest — by the time the
 * countdown ends there is no gesture left to borrow.
 */
export function primeAlertAudio(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

/** One beep: a sine blip with a short fade so it doesn't click. */
function beep(c: AudioContext, startAt: number, freq: number, seconds: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Ramp in and out — an abrupt start/stop on a sine is an audible click.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.01);
  gain.gain.setValueAtTime(0.18, startAt + seconds - 0.03);
  gain.gain.linearRampToValueAtTime(0, startAt + seconds);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + seconds);
}

function playChime(): void {
  const c = context();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume().catch(() => {});
    const t = c.currentTime;
    // Two rising blips — distinct enough to notice over gym noise without
    // being an alarm.
    beep(c, t, 880, 0.12);
    beep(c, t + 0.16, 1320, 0.16);
  } catch {
    // An AudioContext blocked by autoplay policy just means no sound.
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // Unsupported, or blocked because the page isn't visible.
  }
}

/** Sound + vibrate that a rest period has finished. Safe to call anywhere. */
export function playRestDoneAlert(): void {
  playChime();
  vibrate();
}
