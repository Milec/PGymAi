interface Props {
  /** Glow color token. */
  color?: string;
  className?: string;
}

/** Glowing L-shaped corner brackets that frame a panel. */
export function CornerBrackets({ color = 'var(--cyan)', className = '' }: Props) {
  const common: React.CSSProperties = {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: color,
    borderStyle: 'solid',
    borderWidth: 0,
    filter: `drop-shadow(0 0 4px ${color})`,
    opacity: 0.9,
  };
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span style={{ ...common, top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <span style={{ ...common, top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 }} />
      <span style={{ ...common, bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <span style={{ ...common, bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </div>
  );
}
