/** Deep space-navy backdrop: dotted grid + slow drifting cyan/violet aurora. */
export function AuroraBg() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[var(--space-0)]">
      {/* dotted grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(120,200,255,0.14) 1px, transparent 1.4px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at 50% 40%, black 30%, transparent 85%)',
        }}
      />
      {/* aurora blobs */}
      <div
        className="absolute left-1/2 top-[-10%] h-[70vmax] w-[70vmax] -translate-x-1/2 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(56,225,255,0.20), transparent 62%)',
          animation: 'aurora-drift 26s ease-in-out infinite',
        }}
      />
      <div
        className="absolute left-[10%] top-[30%] h-[55vmax] w-[55vmax] rounded-full blur-[130px]"
        style={{
          background:
            'radial-gradient(circle, rgba(162,107,255,0.18), transparent 60%)',
          animation: 'aurora-drift 34s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute right-[5%] bottom-[5%] h-[45vmax] w-[45vmax] rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(255,176,32,0.08), transparent 60%)',
          animation: 'aurora-drift 40s ease-in-out infinite',
        }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(3,5,11,0.7) 100%)',
        }}
      />
    </div>
  );
}
