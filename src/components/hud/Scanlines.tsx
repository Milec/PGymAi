/** Thin luminous scanline sweep overlay. Purely decorative. */
export function Scanlines() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      {/* static scanline texture */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, var(--scanline) 0px, var(--scanline) 1px, transparent 1px, transparent 3px)',
        }}
      />
      {/* moving luminous sweep */}
      <div
        className="absolute left-0 h-[38vh] w-full"
        style={{
          background:
            'linear-gradient(to bottom, transparent, rgba(56,225,255,0.06), transparent)',
          animation: 'scan 7s linear infinite',
        }}
      />
    </div>
  );
}
