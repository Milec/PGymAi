/** Minimal stroked icon set (HUD-style, currentColor). */
type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconDash = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </svg>
);
export const IconLift = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 8v8M18 8v8M2 10v4M22 10v4M6 12h12" />
  </svg>
);
export const IconPlate = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="5" width="3.5" height="14" rx="1" />
    <rect x="17.5" y="5" width="3.5" height="14" rx="1" />
    <path d="M6.5 12h11" />
  </svg>
);
export const IconLibrary = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4h5v16H4zM11 4h4v16h-4z" />
    <path d="M17 5l3 .8-3 14-3-.8" />
  </svg>
);
export const IconChart = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-5 3 3 5-7" />
  </svg>
);
export const IconGauge = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 14l4-4" />
  </svg>
);
export const IconProgram = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
);
export const IconUser = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IconPlus = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCheck = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12l5 5L20 6" />
  </svg>
);
export const IconTrash = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);
export const IconClock = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
export const IconFire = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-1.5.7-2.8 1.5-3.5C8.5 10 9 12 9 12s0-4 3-9z" />
  </svg>
);
export const IconCalendar = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);
export const IconDrop = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />
    <path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" />
  </svg>
);
export const IconTrend = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20v-5M9 20v-9M14 20v-6M19 20V7" />
    <path d="M4 9l5-4 5 3 5-5" />
  </svg>
);
export const IconChevronDown = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconMenu = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
export const IconFuel = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    {/* fork */}
    <path d="M7 3v5a2 2 0 0 0 2 2v11M5 3v4M9 3v4" />
    {/* knife */}
    <path d="M17 3c-2 2-2.5 5.5-1 8v10M16 11h2c1-3 1-6-1-8" />
  </svg>
);
export const IconScan = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 7V4h4M17 4h4v3M21 17v3h-4M7 20H3v-3" />
    <path d="M7 9v6M10.5 9v6M13.5 9v6M17 9v6" />
  </svg>
);
export const IconSearch = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </svg>
);
export const IconTarget = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 12h.01" />
  </svg>
);
export const IconChevronL = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconChevronR = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
